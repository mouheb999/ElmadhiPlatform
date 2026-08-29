# HYPE FITNESS — launch-eve audit

Date: 2026-08-29 · Branch `claude/hype-platform-launch-audit-d13gzb`
Read against the **live** Supabase project, not the migration files.

The first audit (`LAUNCH-AUDIT.md`, 2026-07-31) covered cold-launch performance and
the security posture as far as the migration files could tell it. This one is the
pass after the paywall/reverse-trial rework, and it could reach production, so the
questions that one had to leave open are answered here.

---

## The number

| Stage | Count | Of signups |
|---|---:|---:|
| Signed up | 959 | 100% |
| Gave a phone number | 567 | 59.1% |
| Tapped "I've transferred" | 102 | 10.6% |
| Sent a receipt | 5 | 0.5% |
| Subscribed today | 7 | 0.7% |

83 pending requests, **none with a receipt**, all from the last 30 days, 6,937 TND
of declared value, 60 reachable by phone, 1 chased. Average time from request to an
admin resolving it: 12.2 h, with the customer locked out throughout.

The subscriber count exceeds the receipt count because the rest were confirmed by
hand from WhatsApp — the flow the in-app receipt step was built to replace.

---

## Fixed on this branch (3 commits, not deployed)

**The money path** — `actions/payment.ts`, `actions/admin.ts`, migration 047

1. **Changing plan silently kept the old one.** `startPaymentRequest` updates an
   open request through the user's session; `payment_requests` has RLS for INSERT
   and SELECT and **none for UPDATE**, so the statement matched zero rows and
   PostgREST called that success. Pay for six months, be granted one. Fixed with
   the service-role client, scoped to a row the caller owns and has not had
   resolved, and a zero-row result is now an error. Deliberately *not* an RLS
   UPDATE policy — that would let a caller PATCH their own row to 1 DT / 12 months.
2. **Confirming twice granted two terms.** `nextExpiry` extends a term that has not
   run out, and `activateRequest` never checked the status. The status flip is now
   the lock.
3. **The browser could write its own subscription terms.** A `payment_requests`
   INSERT is reachable directly over PostgREST with the anon key, and activation
   read tier and duration straight off the row. Activation now re-reads the
   duration from `subscription_plans`; migration 047 adds a RESTRICTIVE policy so
   the row cannot describe a plan that is not on sale. Price is not checked —
   prices change, and an old request at an old price is normal to confirm.
4. **Rejecting a confirmed payment** left the record contradicting the account.

**Checkout usability** — `checkout/checkout-client.tsx`

- The "we don't have your receipt yet" prompt was **unreachable code**: it lives on
  a screen that only renders once a receipt exists. A customer in that state — all
  83 of them — came back to the plan grid with nothing saying what was outstanding.
  They now open on step 3 under an amber line, with a way back to the plans.
- "Go to dashboard" on the waiting card bounced straight back to checkout with the
  paywall on. Hidden alongside the other two free-tier exits that already were.
- The activation poll ran every six seconds for everyone reading prices; now only
  for people actually waiting on an admin.

**Auth** — `actions/auth.ts`, `login/login-form.tsx`

A raw `Unexpected token 'H', "Host not i"... is not valid JSON` was shown under the
password field whenever Supabase returned anything that was not JSON. Every failure
now maps to a code the form localises; unrecognised and non-API failures become
"we couldn't reach the server". Also fixes those messages being English in an
Arabic UI. Verified in a browser.

**Ops** — `actions/support.ts`, `lib/notify/telegram.ts`

Support reports pinged nobody, while every payment event pinged Telegram. "I paid
and I'm still locked out" arrives through support. Also: the half-written-ticket
cleanup ran through the user's session, which has no DELETE policy, so it silently
left the ticket it was written to remove; the header notifications bell was wired
to nothing; `lib/supabase/admin.ts` now carries `import "server-only"`.

---

## Applied to production

- **Migration 038** — written weeks ago, never applied. `qa_cards_random` did not
  exist, so the dashboard's Q&A card failed closed to nothing and the feature has
  been invisible on the busiest screen in the app. Verified returning rows.
- **Migration 047** (new) — pins `search_path` on every remaining function, revokes
  EXECUTE on the trigger functions from `anon`/`authenticated` (they were reachable
  at `/rest/v1/rpc/…`; Postgres refuses to run them outside a trigger, so nothing
  was exploitable, but that is a coincidence of the return type, not a boundary),
  and adds the plan-shape policy above. Both refuse to commit unless their own
  checks pass.

## Verified in production

| Check | Result |
|---|---|
| User can set own `is_admin` / `payment_status` | **No** — column UPDATE is `full_name`, `locale`, `phone`, `updated_at` only. Migration 013 landed. |
| Paywall enforced in RLS | **Yes** — all 15 `paid_only_*` RESTRICTIVE policies present. |
| AI spend cap enforced | **Yes** — migration 037's trigger is live; 144 estimates reserved. |
| RLS on every user-owned table | **Yes**, checked table by table. |
| Payment webhook | HMAC-signed with a replay window; 503 while `PAYMENT_WEBHOOK_SECRET` is unset. No provider wired — leave it unset. |
| Leaked-password protection | **Off.** Supabase dashboard toggle. |

---

## Only you can do these

1. **Deploy this branch.**
2. **Confirm billing is enabled on the Gemini key.** The estimator is live and
   answering on `gemini` (144 requests, most recent today). On the free tier Google
   trains on submitted content and human reviewers may see it, and Tunisia is
   outside the EEA carve-out. Real customers' meal photos are going through it.
3. **Turn on leaked-password protection.**
4. **Confirm `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are set in production** —
   without them no ping fires at all, including the new support one.
5. **Decide `REVERSE_TRIAL`** (`src/lib/access.ts`) deliberately. See below.
6. **Walk the checkout flow once.** Nobody has. This container's network policy
   blocks the app from reaching Supabase, so the signed-in flow is verified by
   reading code and schema, not by clicking. Script in the artifact.

---

## The payment flow, as a funnel

The three-step checkout is well built — one decision per screen, a progress bar,
the price restated before the commit, a real conversation attached to the request,
and a poll so activation lands without a reload. The problem is the order of what
it asks:

- **Step 2's button is a free promise with real consequences.** "I've transferred"
  creates a request, flips the account to pending and pings an admin, before any
  money is evidenced — and it sits exactly where a "Next" button sits. 102 tapped
  it; 5 finished the next screen.
- **Step 3 asks for the hardest artefact at the moment of least motivation.** The
  customer has already done the thing they think of as paying.
- **Then 12 hours of nothing**, locked out, on a screen that says "a few hours".

**The one decision worth making tonight.** `REVERSE_TRIAL` exists, is complete, and
is `false`. With it on, building a plan is free and money is asked for only when
someone wants to record against a plan they are already looking at; the paid
surface is protected in the database either way (migration 045). With it off, a
stranger meets a price before a screen of product — which is the configuration the
table at the top of this document was measured in. Not flipped here: it changes
what you are selling on launch day.

If it stays off, three things are still worth doing:

- **Merge steps 2 and 3.** Receipt picker on the same card as the account number,
  one button meaning "sent it, here's the proof". The state 83 people are stuck in
  stops existing.
- **Put the wait time on the button**, where the decision is made.
- **Chase automatically at hour 2.** 60 phone numbers, one manual chase so far.

Before any launch traffic: work the list of 60. They picked a plan and said they
paid — there is no warmer list.

---

## Left alone

- 4 pre-existing lint errors (2 `setState`-in-effect in the admin copy bar, 2
  `require()` in tailwind configs). Admin-only or build-time; the build passes.
- 21% of AI estimates never complete (144 requested, 113 completed). Not
  diagnosable from the events table alone; it is the flagship Premium feature, so
  watch it in week one.
- The i18n dictionary still ships both languages to every client (~34 KB).
- `src/lib/supabase/client.ts` is still imported by nothing.
- A finished workout day locks for the rest of the Tunis week with no undo. That is
  the design, but it will generate support mail from people who tapped Finish early.
