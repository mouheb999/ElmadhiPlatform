---
name: verify
description: How to build, launch, and drive this app to verify changes end-to-end (dev server, disposable Supabase user, Playwright).
---

# Verifying changes in this app (ELMADHI)

Next.js 16 + Supabase (live cloud project, keys in `.env.local`). No test
framework, no seeded test accounts — verification means driving the real app.

## Launch

```powershell
npm run dev   # ready in ~1s on http://localhost:3000
```

## Auth + payment gate

All app routes (`/dashboard`, `/workout`, ...) require a signed-in user whose
`profiles.payment_status = 'active'` (see `src/proxy.ts`) — otherwise you land
on `/checkout`. There are no test credentials in the repo.

Recipe that works (service role key from `.env.local`):
1. `admin.auth.admin.createUser({ email, password, email_confirm: true })`
   — a trigger auto-creates the `profiles` row.
2. `admin.from("profiles").update({ payment_status: "active" }).eq("id", userId)`
3. Seed workout data directly: `training_profiles` → `user_programs` →
   `user_program_days` → `user_program_exercises` (look up `exercises` by
   `name_en`). Fetch the day id for `/workout/session/<dayId>`.
4. Cleanup: `admin.auth.admin.deleteUser(userId)` — everything cascades.

Gotcha: standalone node scripts can't resolve `@supabase/supabase-js` from
outside the repo. Drop the script inside `node_modules/` (e.g.
`node_modules/.verify-x.mjs`) so resolution walks up to the project, and
delete it afterward.

## Drive

Playwright is not a dependency; `npx playwright install chromium` then run
driver scripts from the npx cache dir (`%LOCALAPPDATA%\npm-cache\_npx\<hash>\`)
so `import { chromium } from "playwright"` resolves.

- Use a mobile viewport (390×844) — the product is mobile-first.
- **Default locale is Tunisian Arabic (RTL).** Text locators must use Arabic
  strings (e.g. the kg label is `كغ`, skip is `فوّت`). `aria-label`s like
  `Set 1 done` and `Swap exercise` are English.
- Login form: `input[type=email]`, `input[type=password]`, submit button →
  lands on `/dashboard`.
- Key flows: `/workout/program` (editor + swap list), `/workout/session/<dayId>`
  (logging: set inputs, done check per set, rest timer pill, finish button).
  Session drafts persist in localStorage per day — reload to test restore.
