# ELMADHI — pre-launch audit

Date: 2026-07-31 · Branch `main` @ `450bd43` · Next 16.2.9 / React 19.2.4

Two passes: **cold launch + navigation feel**, and **security**. A prioritised plan
is at the end.

Worth saying up front, because it shapes the priorities: the authorisation
architecture is genuinely well built. Migration 013 revokes column UPDATE on
`profiles` and grants back only `full_name, locale, updated_at`, which closes the
classic "user sets their own `is_admin`" escalation. `requirePaidUser()` guards at
the data boundary rather than only at the route. Every admin action calls
`requireAdmin()` before it touches the service-role client. Payment amounts are
read server-side from `subscription_plans`, never from the client. RLS covers
every user-owned table. None of the findings below are holes in that design — they
are the edges around it.

---

## Part 1 — Cold launch and navigation

### 1.1 The app shell serialises two round-trips ahead of every page

`src/app/(app)/layout.tsx:27-33`

```
const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
const supabase = await createClient();
const unreadSupport = await countUnreadSupportReplies(supabase, user.id);
```

The layout `await`s before it returns `{children}`, so the page's own queries
cannot begin until the support-badge query has come back. A decorative dot on the
header icon sits on the critical path of **every single screen** in the app —
Dashboard, Diet, Workout, Q&A, Settings.

This is the highest-leverage fix in the document, because it is one file and it
speeds up all six tabs at once.

**Fix:** move the badge into a `<Suspense>` boundary so the shell streams
immediately and the dot arrives late, or fold the unread count into a query the
page is already making.

### 1.2 Nothing streams — every route is `force-dynamic` with no Suspense

28 files carry `export const dynamic = "force-dynamic"`, and `grep -rn Suspense
src --include=*.tsx` returns exactly one hit (`login/page.tsx`). The consequence:
the *entire* page's data must resolve before the first byte of HTML ships. TTFB
on a cold launch is the sum of the slowest query chain, and the user stares at a
white screen for all of it.

`src/app/(app)/loading.tsx` helps on client-side tab switches — but it does
nothing for the cold launch, which is the complaint.

**Fix:** wrap the below-the-fold sections (`ProgressTeaser`, `NutritionLiveTile`,
`QaSpark`) in `<Suspense>` with their own skeletons and let the top of the page
paint first.

### 1.3 Dashboard runs three sequential query rounds

`src/app/(app)/dashboard/page.tsx` — 9 queries in round 1 (line 62), 2 in round 2
(line 118), and `user_program_days` alone in round 3 (line 163). Twelve queries,
three serial network legs to Supabase, before anything renders.

Round 3 is avoidable: `user_program_days` is only reachable via `user_programs.id`,
which comes from round 2 — but `user_programs` and `user_program_days` can be
fetched as one nested PostgREST select off `training_profile_id`, collapsing three
rounds into two.

### 1.4 The dashboard downloads the whole Q&A library on every load

`src/app/(app)/dashboard/page.tsx:81`

```
supabase.from("qa_cards")
  .select("id, question_en, question_ar, answer_short, answer_short_ar")
  .eq("is_published", true)
```

Every published card, four text columns each — then `shuffled(..., 5)` at line 234
throws away all but five. There are ~150 seeded cards today and the library is
meant to grow. This is unbounded waste on the busiest screen in the app.

**Fix:** `.limit(30)` plus a random offset, or a small `qa_cards_random(5)` RPC.

### 1.5 The workout session screen is the slowest route in the app

`src/app/(app)/workout/session/[dayId]/page.tsx` opens with three separate awaits
(lines 33-35: `createClient`, `getLocale`, `getCurrentUser` — these are
independent and should be one `Promise.all`), then up to four more sequential
query rounds at lines 63, 94/134, 183 and 232.

This is the screen a user opens *in the gym*, on mobile data, mid-set. It deserves
the best latency in the product and currently has the worst.

### 1.6 The i18n dictionary ships both locales to the client

`src/lib/i18n.ts` is 68 KB, ~659 keys, English and Tunisian Arabic in one module —
and 36 client components import `t` from it. Because the locale is chosen at
runtime, bundlers cannot tree-shake the unused half. Every user downloads the
language they are not reading.

**Fix:** split into `i18n/en.ts` and `i18n/tn.ts`, resolve server-side, and pass
the active dictionary down through a provider. Roughly halves the i18n payload.

### 1.7 Images

- `public/logo.png` is **656 KB** and renders at 96 px (`components/layout/logo.tsx:35`).
  It goes through `next/image` so users get an optimised variant, but the first
  request pays a cold optimiser miss on a 656 KB source. Re-export the mark at
  ~256 px; it should be under 20 KB.
- Nine raw `<img>` tags bypass the optimiser entirely — `exercise-media.tsx:117,158`,
  `food-diary.tsx:65`, `meal-card.tsx:97`, `exercise-card.tsx:94`,
  `calorie-ai-client.tsx:341`, `image-upload.tsx:55`, `exercises-client.tsx:160`.
  The exercise illustrations are 29–56 KB webp each, served at full source
  resolution to a ~400 px phone with no `srcset`, and only one of them sets
  `loading="lazy"`.

  `next.config.ts` is empty, which is presumably why: `next/image` on the
  Supabase-hosted URLs needs `images.remotePatterns`. Local assets under
  `public/exercise-library` can move to `next/image` today with no config at all.

### 1.8 Already good — don't undo these

Bottom-nav prefetch plus `useLinkStatus()` for instant tap feedback
(`app-bottom-nav.tsx`), the `getClaims()` local JWT verification replacing per-request
`getUser()` round-trips (`current-user.ts`), the signed paywall-gate cookie that
avoids a `profiles` read on every navigation (`paywall-gate.ts`), and the RLS
`(select auth.uid())` InitPlan rewrite in migration 030. These are the reasons the
app is not considerably slower than it is.

---

## Part 2 — Security

### S1 — The AI meal estimator has no rate limit — CRITICAL (money)

`src/app/actions/ai-estimate.ts:14`. `estimateMealAction` validates image size and
MIME type, then calls a vision model. There is no per-user quota, no cooldown, no
daily cap — `grep -rni 'ratelimit|throttle'` across `src/` and the migrations
returns nothing.

Any account with an active subscription can loop this action. Each call is a
vision-model request against your Anthropic or Gemini key plus a USDA lookup. One
shared login, one scripted client, or one enthusiastic user and the bill is
uncapped. Compare Q&A asks and plan rebuilds, which *are* quota'd by database
triggers (migrations 033/034) — the expensive path is the one left open.

**Fix before launch:** a per-user daily cap enforced in the database, same shape as
the existing redo-quota triggers. 20–30/day is generous for a real user and
catastrophe-proof against a loop.

### S2 — Open redirect on the OAuth callback — HIGH

`src/app/auth/callback/route.ts:11,17`

```
const next = searchParams.get("next") ?? "/dashboard";
return NextResponse.redirect(`${origin}${next}`);
```

`next` is never validated. `next=@evil.com` produces `https://yoursite.com@evil.com`,
where `yoursite.com` is parsed as userinfo and the actual host is `evil.com`.

**Fix:** `const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";`

### S3 — Open redirect on the login form — HIGH

`src/app/login/login-form.tsx:28,65`. `next` comes straight from the query string
into `router.push(next)`. `?next=https://evil.com` sends the user off-site
immediately after a genuine sign-in — the highest-trust moment in the session, and
exactly the pretext a credential-phishing lookalike wants. Same one-line fix.

### S4 — The payment webhook is a bearer secret, not a signature — HIGH

`src/app/api/webhook/payment/route.ts:20`. The `x-webhook-signature` header is
compared directly against `PAYMENT_WEBHOOK_SECRET`. That is not an HMAC: it is not
bound to the request body, carries no timestamp, and has no replay protection. The
endpoint grants paid access to an arbitrary `userId`.

The code says `TODO(mouheb): replace with real HMAC verification once a provider is
chosen` and it fails closed when the secret is unset — so it is a known stub. But
it is a live route in the production build (`ƒ /api/webhook/payment`).

**Fix before launch:** if no provider is wired yet, delete the route and re-add it
with the real HMAC when Konnect/Flouci is chosen. A dead endpoint that grants
subscriptions should not be reachable at launch. Minor, while you're there:
`constantTimeMatch` returns early on a length mismatch, leaking secret length.

### S5 — No security headers at all — MEDIUM

`next.config.ts` is empty and there is no `vercel.json`. No CSP, no HSTS, no
`X-Content-Type-Options`, no `frame-ancestors`. The app embeds a YouTube iframe
(`exercise-media.tsx:41`) and renders markdown via `react-markdown`, so a CSP has
real work to do here. This is a 20-line `headers()` block in `next.config.ts`.

### S6 — The service-role key doubles as the paywall HMAC key — MEDIUM

`src/lib/paywall-gate.ts:29` returns `SUPABASE_SERVICE_ROLE_KEY` as the cookie
signing secret. It works, and the key never leaves the server — but it couples two
unrelated lifetimes. Rotating the Supabase key silently invalidates every gate
ticket, and any future bug that exposes the signing key exposes full database
access rather than the ability to forge a 2-minute paywall pass.

**Fix:** a dedicated `GATE_SIGNING_SECRET`, falling back to the current behaviour
if unset so nothing breaks mid-deploy.

### S7 — `siteUrl()` trusts the Host header — LOW (config-dependent)

`src/app/actions/auth.ts:13` falls back to `x-forwarded-host` / `host` when
`NEXT_PUBLIC_SITE_URL` is unset. Those headers are attacker-controlled, and the
value becomes the `emailRedirectTo` on sign-up confirmation links. Dead code as
long as the env var is set in production — which makes "confirm it is set" a
launch-checklist item rather than a code change.

### S8 — Meal logs are dated in UTC while everything reading them uses Tunis — HIGH (correctness)

Not an attack, but it is a data-integrity bug that will read to users as the app
losing their food.

- Writes: `src/app/actions/meal-logs.ts:48` and `src/app/actions/ai-estimate.ts:87`
  both use `new Date().toISOString().slice(0, 10)` — **UTC**.
- Reads: `src/app/(app)/dashboard/page.tsx:55` uses `tunisDateKey()` — **Tunis, UTC+1**.
- `src/app/(app)/diet/_views/today-view.tsx:14,39` is on the UTC side too.

Between **00:00 and 01:00 Tunis time**, a logged meal is written with yesterday's
date and disappears from Today. Late dinners and post-midnight snacks are not an
edge case for this audience. `src/lib/dates.ts` already exists and documents
exactly this rule — these three call sites just never adopted it.

**Fix:** replace all three with `tunisDateKey()`. Half an hour, including checking
`copyPreviousDay`, which inherits the same bug.

### S9 — Verify every migration is actually applied in production

Several migrations are marked "pending manual apply" in my notes (018, 027, 028,
033, 034), and the Supabase MCP account cannot reach this project, so I could not
confirm the live schema.

This matters more than it sounds: **migration 013 is what prevents a user from
setting their own `is_admin`**. If 013 did not land, `own_profile FOR ALL USING
(auth.uid() = id)` from migration 008 lets any signed-in user grant themselves
admin and a free lifetime subscription through the public REST API.

**Before launch, confirm against production:**

```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'profiles' and privilege_type = 'UPDATE';
```

The only columns listed for `authenticated` should be `full_name`, `locale`,
`updated_at`. Anything else — especially `is_admin`, `payment_status`, `has_paid`,
`plan_expires_at` — means 013 did not apply and the app is wide open.

---

## Part 3 — Prioritised plan

### P0 — before you launch

Code work is **done** (2026-07-31). Build passes, 129 tests pass, lint clean.

| # | Item | Status |
|---|------|--------|
| 1 | **S9** Verify migration 013's column grants in prod | ⚠️ **needs you** — see below |
| 2 | **S1** Daily cap on AI meal estimates | ✅ code done · ⚠️ migration 037 needs applying |
| 3 | **S2 + S3** Validate `next` in both redirects | ✅ done, 12 unit tests |
| 4 | **S4** Properly sign the payment webhook | ✅ done |
| 5 | **S8** Use `tunisDateKey()` for meal-log dates | ✅ done |
| 6 | **1.1** Get the support badge off the critical path | ✅ done |
| 7 | **S7** Confirm `NEXT_PUBLIC_SITE_URL` is set in prod | ⚠️ **needs you** — hosting env |

#### What was changed

- **New** `src/lib/safe-redirect.ts` + tests — `safeNextPath()` narrows `?next=`
  to a same-origin path. Wired into `auth/callback/route.ts` and `login-form.tsx`.
- **New** `supabase/migrations/037_ai_estimate_quota.sql` + `src/lib/ai-quota.ts` —
  30 estimates/user/day, counted in Africa/Tunis. `estimateMealAction` now
  *reserves* the call by inserting its `ai_estimate_requested` event **before**
  touching the provider, and that insert is what the trigger gates — so a direct
  POST loop is refused by the database and never reaches a metered API. The
  analytics payload moved to a new `ai_estimate_completed` event (nothing read
  the old one).
- `api/webhook/payment/route.ts` — bearer-secret compare replaced with
  HMAC-SHA256 over `${timestamp}.${rawBody}`, five-minute replay window,
  `503` when unconfigured. Header format documented in `.env.example`.
- `actions/meal-logs.ts`, `actions/ai-estimate.ts`,
  `diet/_views/today-view.tsx` — all three now date rows with `tunisDateKey()`.
  This also fixes `copyPreviousDay`, which inherited the bug.
- `(app)/layout.tsx` — the unread-support query moved into a suspended
  `<SupportUnreadDot>`. The shell no longer awaits anything but auth + locale.

#### Two things only you can do

**1. Run `supabase/verify_prod_security.sql`** in the Supabase SQL editor against
production. Check 1 is the one that matters: the `profiles` UPDATE grants for
`authenticated` must be exactly `full_name`, `locale`, `updated_at`. Anything
else means migration 013 never applied, and any signed-in user can grant
themselves admin and a free subscription through the public REST API.

**2. Apply migration 037** — until it runs, the AI cap is not enforced. The
reservation insert succeeds without the trigger, so the app behaves normally and
gives no sign the ceiling is missing. Check 3 in the verification script confirms
it landed.

Also worth fixing while you're in there: `.gitignore` excludes `.env*`, which
catches `.env.example` too — it is untracked, so a fresh clone has no env
template. `!.env.example` fixes it.

#### What I could not verify

The signed-in shell was not driven end-to-end. Doing so needs a real user in the
live Supabase project, and creating one was blocked as a write to production
data. Build, types, lint and unit tests all pass, and the unauthenticated paths
were checked in the browser (login renders, `/dashboard` correctly bounces to
`/login?next=%2Fdashboard`, no console or server errors) — but nobody has clicked
through a logged-in session with these changes. Do that before you ship,
especially the /diet Today view and the AI estimator.

### P1 — launch week

Done (2026-07-31). Build passes, 129 tests pass, lint clean.

| # | Item | Status |
|---|------|--------|
| 8 | **1.2** Suspense boundaries on dashboard + diet | ✅ done |
| 9 | **1.4** Limit the Q&A card query | ✅ done · ⚠️ migration 038 needs applying |
| 10 | **1.5** Collapse the session screen's opening awaits | ✅ done — **smaller than estimated, see below** |
| 11 | **S5** Security headers | ✅ done, verified serving |
| 12 | **1.7a** Re-export `logo.png` | ✅ done — **also smaller than estimated** |
| 13 | **1.3** Collapse the dashboard's third query round | ✅ done |

#### What was changed

- **Dashboard** — the nutrition tile and the Q&A spark moved into
  `dashboard/_sections/` as suspended async components. They own four of the
  page's queries, including the only two-round chain on it
  (`diet_profiles` → `macro_targets`), and nothing above them depends on the
  answers. The critical path went from **9 queries over 3 rounds** to
  **5 queries over 2**. The program's days are now embedded in the
  `user_programs` select rather than fetched in a round of their own.
- **`/diet`** — the two views are suspended behind a skeleton, keyed on
  view+date so switching Today/Plan remounts instead of silently holding the
  old view while the new one loads.
- **Migration 038** — `qa_cards_random(n)` samples in the database.
  The dashboard now receives 5 rows instead of the entire published library,
  and every card stays reachable (a bounded `LIMIT` would have made cards
  beyond the first N unreachable from the spark). `SECURITY INVOKER`, so RLS
  still applies and it cannot expose unpublished drafts.
- **`next.config.ts`** — CSP, HSTS, `X-Frame-Options`, nosniff,
  `Referrer-Policy`, `Permissions-Policy` (with `camera=(self)`, which the meal
  photo flow needs), and `poweredByHeader: false`. Verified serving on `/login`
  with no console violations, HMR still connected, React still hydrating.
- **`logo.png`** — 860×522 / 656 KB → 512×311 / 104 KB, truecolor. 512 rather
  than 256 because `icon.tsx` renders the mark at 340 px inside the 512×512 PWA
  icon; 256 would have softened it.

#### Two corrections to this document

Both estimates above were wrong in the same direction — I had ranked these off
code reading, and looking closer they matter less than 1.1 and 1.2 do:

1. **Item 10 was overstated.** I described the session page's opening awaits as
   "four round-trips stacked". They are not: `createClient()` and `getLocale()`
   only read cookies, and `getCurrentUser()` verifies the JWT locally against a
   process-cached JWKS. The `Promise.all` is still correct — `getClaims()` does
   reach the network on a cache miss or a near-expiry refresh — but the win is
   occasional, not per-request. The same pattern appears on 13 pages; I left the
   other 12 alone rather than churn them for a negligible gain.

2. **Item 12 was overstated.** Users never downloaded the 656 KB source —
   `next/image` was already serving a 96 px variant, confirmed in the network
   log. The real saving is build work, the image optimizer's cold miss, and repo
   weight. Still worth the fifteen minutes; not a user-facing latency win.

#### Also found

`src/lib/supabase/client.ts` — the browser Supabase client — is imported by
nothing. Every read and write goes through a Server Function. It is dead code,
and worth deleting so nobody wires the browser straight to the database by
reaching for the file that is already sitting there.

### P2 — first month

| # | Item | Payoff | Effort |
|---|------|--------|--------|
| 14 | **1.6** Split the i18n dictionary per locale | ~34 KB off the client bundle. | 3–4 h |
| 14b | **S5b** Nonce-based `script-src` | The CSP shipped in P1 carries `'unsafe-inline'` on scripts. Needs a nonce threaded through `updateSession` and a wider proxy matcher — a change to make with time to test it. | 3–4 h |
| 14c | Delete `src/lib/supabase/client.ts` | Dead code that invites wiring the browser straight to the database. | 10 min |
| 15 | **1.7b** `next/image` for exercise illustrations | Responsive `srcset` on the gym screen. Local assets need no config. | 2–3 h |
| 16 | **S6** Dedicated `GATE_SIGNING_SECRET` | Decouples key rotation from paywall tickets. | 30 min |
| 17 | **1.5** Restructure the remaining session-page query rounds | The deeper fix behind item 10. | 3–4 h |
| 18 | Per-route `loading.tsx` skeletons | The single dashboard-shaped skeleton is shown for every route. | 2–3 h |
| 19 | Wire up or remove the header notification bell | `(app)/layout.tsx:54` renders a button that does nothing. | 1 h |

---

## What I did not audit

- Runtime behaviour under real network conditions — no Lighthouse or field
  measurements were taken; every performance finding above is from reading the
  code, and the ordering reflects expected impact rather than measured impact.
- The live production database — the Supabase MCP account cannot reach this
  project, so RLS was read from the migration files and the applied state is
  unverified (hence S9).
- Third-party model providers' data handling. Note the warning already in
  `.env.example`: on Gemini's free tier, submitted content is used for training and
  may be seen by human reviewers, and Tunisia is outside the EEA carve-out. If real
  users' meal photos will hit Gemini, billing must be enabled first. That is a
  privacy commitment to your users, not just a config detail.
