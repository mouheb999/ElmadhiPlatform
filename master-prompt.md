# Master Build Prompt — Self-Coaching Fitness Platform

## Your Mission

You are building a production-grade, self-coaching fitness platform for the Tunisian market. The user has paid for personalized diet and workout guidance without a human coach. The platform replaces that coach.

The architecture is fully specified in `architecture.md` at the repo root. **Read it completely before writing any code.** That document is the source of truth for schema, folder structure, algorithms, and product behavior. This prompt tells you *how* to build, in what order, and to what quality bar.

---

## Repo Context

This repo already contains a theme starter with:
- `src/components/ui/` — shadcn/ui primitives, fully styled
- `tailwind.config.ts` — custom theme tokens and design system
- `src/app/globals.css` — design tokens, fonts, base styles
- Possibly some library helpers in `src/lib/`

**You must not overwrite the theme starter.** Read every file in `src/components/ui/`, `tailwind.config.ts`, and `src/app/globals.css` before doing anything else. Then build every feature on top of those primitives using those tokens. No new color values. No new font choices. No re-implementing buttons, cards, inputs, dialogs that already exist.

---

## Stack (non-negotiable)

- Next.js 14+ App Router, TypeScript strict mode
- Supabase (Postgres, Auth, Storage) — use the `@supabase/ssr` package for Next.js integration
- Server Actions for all mutations
- React Query (`@tanstack/react-query`) for client-side cache
- Tailwind CSS using the theme starter tokens
- shadcn/ui primitives from the theme starter
- Deployed on Vercel

---

## Product Overview

Three pillars, each a self-contained section the user enters from the dashboard:

**1. Diet Maker** — Questions → Macro calc → Rationale screen → Editable meal plan
**2. Workout Maker** — Questions → Program match → Rationale screen → Editable program
**3. Q&A Library** — TikTok-style vertical swiper of curated cards

Each Maker section has a "Redo my goals" button that re-asks the questions and creates a new plan version, archiving the old one.

Edits to plans show warnings (not blocks) when the user breaks the logic.

---

## Critical Product Rules

1. **No jargon in user-facing copy.** Never write "bulk", "cut", "TDEE", "macros", "hypertrophy", "caloric deficit". Translate to plain language. "What do you want?" not "Select your goal." "How does your day look?" not "Activity level." This applies to every label, button, and helper text.

2. **One question per screen** in the wizards. Big tappable cards for options. Smooth left/right transitions between steps. Progress dots at top.

3. **Rationale screens explain *why*.** They use data from the user's answers and the algorithm's decision. Use plain language. Use structured sections like "Why we picked this for you" with 3-4 short paragraphs. Show numbers contextually (you weigh X, you burn Y, we give you Z).

4. **Editors are real-time.** When the user swaps a food or changes a quantity, macro totals recalculate instantly on the client. No round-trip. Validation runs on save or on debounced field blur.

5. **Demo content is fine for v1.** Seed the food/exercise/Q&A tables with placeholder data so the flows work end-to-end. The user will refine real content after validating the architecture.

6. **Mobile-first.** Most users will be on phones. Every screen must work at 360px width. Use Tailwind responsive utilities. Test scroll behavior.

7. **French + Arabic copy in the UI.** Default to French for now (`name_fr`, `question_fr`). Arabic columns exist in the schema; leave the UI hooks in place but don't build the language switcher yet.

---

## Build Order

Execute in this exact order. Don't jump ahead.

### Phase 0 — Read and inventory (30 min equivalent)

1. Read `architecture.md` start to finish.
2. List every file in `src/components/ui/`. Note which primitives exist.
3. Read `tailwind.config.ts` and `src/app/globals.css`. Note the tokens.
4. Read `package.json`. Note installed dependencies. Don't add duplicates.
5. Output a summary of what you found before writing any code.

### Phase 1 — Supabase setup

1. Create a `supabase/migrations/` folder.
2. Write SQL migration files in order, exactly as specified in `architecture.md` Section 3:
   - `001_extensions.sql` — enable `pg_trgm`, `pgcrypto`
   - `002_profiles.sql`
   - `003_diet_tables.sql` — diet_profiles, macro_targets, foods, recipes, recipe_ingredients, user_foods, meal_plans, meal_plan_meals, meal_plan_items
   - `004_workout_tables.sql` — training_profiles, exercises, program_templates, template_days, template_exercises, user_programs, user_program_days, user_program_exercises, workout_sessions, workout_sets
   - `005_qa_tables.sql` — qa_categories, qa_cards
   - `006_indexes.sql`
   - `007_search_triggers.sql`
   - `008_rls_policies.sql`
3. Write a `supabase/seed.sql` with demo data:
   - 50 common Tunisian foods (estimated macros are OK)
   - 10 Tunisian recipes (couscous, lablabi, ojja, brik, mloukhia, shorba, salade méchouia, kafteji, slata tounsia, makroudh)
   - 80 common exercises across all muscle groups and equipment types
   - 6 program templates covering the main (days × experience × equipment) combos
   - 15 Q&A cards across nutrition, training, recovery categories

4. Set up `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` using `@supabase/ssr`. The middleware client must use `getUser()`, not `getSession()`.

5. Run `supabase gen types typescript` and save the output to `src/types/db.ts`.

### Phase 2 — Auth, middleware, payment

1. `src/middleware.ts` checks session and `profiles.has_paid` for `/diet`, `/workout`, `/qa`, `/dashboard`, `/settings` routes.
2. `/login/page.tsx` — email/password and Google OAuth via Supabase Auth.
3. `/checkout/page.tsx` — placeholder for payment integration. For now, a button that calls a server action setting `has_paid = TRUE` (we'll wire Konnect/Flouci later). Add a TODO comment.
4. `/api/webhook/payment/route.ts` — stub that verifies a fake signature and updates `profiles.has_paid`.

### Phase 3 — Layout shell

1. `(app)/layout.tsx` — auth guard, top nav (logo + nav items + avatar menu), bottom nav for mobile.
2. `/dashboard/page.tsx` — three large cards: "Your diet", "Your workout", "Learn". Each card shows a status (Not started / Active / Last updated X days ago) and a CTA.

### Phase 4 — Shared building blocks

1. `components/shared/question-wizard.tsx` — generic step-by-step wizard. Props: `steps: WizardStep[]`, `onComplete: (answers) => Promise<void>`. Handles state, navigation, progress dots, transitions. Each step renders custom children with `setAnswer(key, value)`.
2. `components/shared/rationale-card.tsx` — section with headline, paragraph, optional metric chip. Used to compose rationale screens.
3. `components/shared/warning-banner.tsx` — yellow banner with icon, message, dismiss button.
4. `lib/algorithms/macros.ts` — pure function `calculateMacros(profile) => MacroTargets`. Implement exactly as in `architecture.md` Section 5.
5. `lib/algorithms/validation.ts` — `validateMealPlan(plan, target)` and `validateProgram(program, profile)` returning `Warning[]`.

### Phase 5 — Diet Maker

1. `/diet/page.tsx` (RSC) — fetch active meal plan; if none, show "Start your diet" CTA → `/diet/questions`. If exists, show summary + "View plan" / "Redo my goals".
2. `/diet/questions/page.tsx` (client) — use `QuestionWizard`. 11 steps as listed in `architecture.md` Section 4. On complete, call `actions/diet.ts → submitDietQuestions(answers)`.
3. `actions/diet.ts`:
   - `submitDietQuestions(answers)` — creates `diet_profile`, runs `calculateMacros`, saves `macro_targets`, runs `generateMealPlan`, saves the plan, returns the new plan id and redirects to `/diet/rationale`.
   - `generateMealPlan(dietProfileId, macroTargets)` — implements algorithm in `architecture.md` Section 5.
   - `saveMealPlanEdit(planId, items)` — upsert items, mark plan `user_modified = TRUE`.
   - `redoDietGoals()` — sets old `diet_profile.is_active = FALSE` and corresponding plan inactive, then redirect to `/diet/questions`.
4. `/diet/rationale/page.tsx` (RSC) — reads the latest macro_targets, renders `rationale_json` as a series of `RationaleCard`s, ends with "See my plan" button → `/diet/plan`.
5. `/diet/plan/page.tsx` — server component shell that loads the plan, hands data to a client `PlanEditor`.
6. `components/diet/plan-editor.tsx` (client):
   - Top: macro ring showing today's totals vs targets, live updating.
   - Below: meals (breakfast/lunch/dinner/snacks), each with food items.
   - Each item: tap to edit quantity, tap to replace (opens food search), tap to delete.
   - Add food button per meal → opens food search.
   - On every change, recompute totals client-side.
   - On save, post to `saveMealPlanEdit`. Show warnings if any.
7. `components/diet/food-search.tsx` — debounced search hitting `/api/foods/search`, results in a sheet/drawer.
8. `/api/foods/search/route.ts` — edge runtime, full-text search with trigram fallback as specified.

### Phase 6 — Workout Maker

Mirror Phase 5 but for workouts.

1. `/workout/page.tsx`, `/workout/questions/page.tsx`, `/workout/rationale/page.tsx`, `/workout/program/page.tsx`.
2. `actions/training.ts`:
   - `submitWorkoutQuestions(answers)` — creates `training_profile`, runs `generateProgram` (template match + clone + injury swap), redirects to rationale.
   - `generateProgram(trainingProfileId)` — algorithm in `architecture.md` Section 5.
   - `saveProgramEdit(programId, days)` — upsert exercises.
   - `redoWorkoutGoals()` — archives old, redirects to questions.
3. `components/workout/program-editor.tsx`:
   - Tabs or accordion for days.
   - Each exercise: name, sets × rep range, rest, swap button (opens exercise picker filtered by same muscle group).
   - Add exercise button per day.
   - Validation warnings on save.

### Phase 7 — Q&A Library

1. `/qa/page.tsx` (RSC) — fetch published Q&A cards, hand to client `QAFeed`.
2. `components/qa/qa-feed.tsx`:
   - Vertical swipe (touch + wheel + arrow keys).
   - One card at a time, full-screen on mobile.
   - Preload next 2 cards.
   - Use CSS scroll-snap-y for smooth native feel.
3. `components/qa/qa-card.tsx`:
   - Question as headline.
   - Short answer as subhead.
   - Long answer markdown body.
   - Visual slot rendering based on `visual_type` (placeholder for now: render an empty `<div>` with class "visual-placeholder" — user will fill in later).
   - Scientific sources collapsed at bottom.
4. `/qa/[slug]/page.tsx` — direct link to a card, opens the feed scrolled to that card.

### Phase 8 — Settings, history, polish

1. `/settings/page.tsx` — name, email, theme toggle, sign out.
2. `/diet/history/page.tsx` and `/workout/history/page.tsx` — list past plan versions, read-only view of each.
3. Add loading skeletons (`loading.tsx`) to every `(app)/` route.
4. Add error boundaries (`error.tsx`) to every `(app)/` route.
5. Add `not-found.tsx` to relevant routes.

### Phase 9 — Marketing + launch

1. `(marketing)/page.tsx` — landing page (hero, 3 sections explained, pricing CTA).
2. `(marketing)/pricing/page.tsx` — single tier, "Get started" → checkout.
3. Lighthouse pass. Aim for 90+ on landing.
4. README with setup instructions, env vars, migration commands.

---

## Quality Bar

- **TypeScript strict.** No `any`. Every server action has typed input and output. Use generated DB types.
- **Server vs client boundary is intentional.** Don't slap `'use client'` on layouts. Push interactivity to leaf components.
- **No prop drilling beyond 2 levels.** Use React Query or composition.
- **All forms use server actions.** No `fetch` to internal API routes for mutations.
- **Loading states everywhere.** Every async operation has skeleton or spinner.
- **Empty states everywhere.** "You haven't started yet" with a clear CTA.
- **Error handling.** Server actions return `{ ok: true, data } | { ok: false, error }`. Client surfaces errors with toast or inline message.
- **Accessibility.** All interactive elements keyboard-navigable. `aria-label` on icon buttons. Focus visible.
- **No console.logs in committed code.**
- **No `@ts-ignore` without a comment explaining why.**

---

## Environment Variables

Create `.env.example` with:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=
```

---

## What You Should Not Do

- Don't add UI libraries beyond what's installed (no Material UI, no Chakra, no Mantine). shadcn/ui only.
- Don't add styled-components, emotion, or any CSS-in-JS. Tailwind only.
- Don't replace the existing UI primitives.
- Don't write your own auth. Use Supabase Auth.
- Don't build the workout logger or progress tracking in this phase — schema is ready, UI comes later.
- Don't add a notification system, streak counter, or community features. Schema-only for now, no UI.
- Don't internationalize yet. French copy in code is fine.
- Don't optimize prematurely. Build correctly first, profile if needed.

---

## Working Style

- Plan each phase before writing files. Output a short plan, then execute.
- After each phase, run `tsc --noEmit` and fix every error before moving on.
- Commit after each phase with a clear message.
- If a decision isn't covered here or in `architecture.md`, make the most boring, conventional choice and add a comment `// TODO(mouheb): confirm decision`.
- If you find a conflict between this prompt and `architecture.md`, the architecture file wins for schema and algorithms; this prompt wins for build order and style.

---

## Definition of Done

The platform is done when a new user can:

1. Land on the marketing page
2. Pay (test mode)
3. Sign up
4. Land on dashboard
5. Open Diet Maker, answer 11 questions, see rationale, see editable plan, edit a meal, save with warnings shown if applicable, redo goals
6. Open Workout Maker, answer 6 questions, see rationale, see editable program, swap an exercise, save with warnings if applicable, redo goals
7. Open Q&A, swipe through 15 cards smoothly
8. Sign out and sign back in to find their plans still there

When all 8 work end-to-end on mobile and desktop with no console errors, you're done.

Begin with Phase 0. Read everything. Show me what you found. Then proceed.
