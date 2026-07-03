# ELMADHI — Personalization Engine Blueprint (v3)

Status: planning document, no code changes implied. Supersedes `architecture.md` (v2) on
language, payment, and personalization depth; **does not** replace its schema/folder
structure/dev-order, which remain valid and are referenced, not repeated, below.

Source material consulted:
- `architecture.md`, `master-prompt.md` (existing v2 plan)
- Current repo state (`src/`, `supabase/migrations/`) — auth, admin CMS for foods/exercises,
  WhatsApp-confirmation payment flow, and a working EN/Tunisian-Arabic i18n layer already exist
- `AbuzDietPlan.pdf` and `AbuzWorkoutSplits.pdf` (@abuz.lifts beginner handbooks, provided today)
- 5 UI mockups provided today (Q&A library, Diet Maker wizard, checkout screen)

---

## 0. Corrections to stale assumptions (read this first)

Three things in the original brief and in `architecture.md` are wrong relative to what's
actually true today. Fixing these before anything else, because they'd otherwise silently
contaminate the rest of the blueprint:

1. **Language is English + Tunisian Arabic (Derja), never French.** `architecture.md` §4 and
   `master-prompt.md` default all copy to French. That was overridden weeks ago — `src/lib/i18n.ts`
   already implements `en`/`tn` with RTL for Tunisian Arabic and a hard comment banning French.
   Every string, table column, and question below uses `_en`/`_ar` naming, never `_fr`.

2. **Payment is not Konnect/Flouci.** The real flow (already built in `src/app/actions/payment.ts`,
   `src/app/admin/page.tsx`, and confirmed by today's checkout mockup) is: user picks bank
   transfer or D17 wallet, pays manually, taps "I've paid — confirm on WhatsApp," and an admin
   activates the account from `/admin`. No payment gateway integration exists or is planned yet.
   Architecture v2's checkout section is obsolete.

3. **The stack is Next.js 16, not "14+."** `package.json` pins `next@16.2.9` and `react@19.2.4`.
   `AGENTS.md` already flags that this version has breaking changes from training-data Next.js —
   anyone implementing this blueprint must read `node_modules/next/dist/docs/` first, particularly
   for data fetching, caching (`unstable_cache` may have moved), and routing conventions before
   writing the Phase 5+ code in `master-prompt.md`.

One more correction, aimed at the brief itself: the two PDFs are **beginner-level Instagram
lead-magnet handbooks** from a single coach (@abuz.lifts) — six content pages on nutrition, nine
on training. They are good, honest, usable material (see §5–6), but they are not a substitute for
a sports-science textbook, and there is nowhere near enough source content to derive a "large
decision tree" purely from them. What follows uses the PDFs verbatim wherever they give a rule,
and clearly-labeled standard coaching practice everywhere else (injuries, budget, Ramadan, cooking
skill, etc. — none of which the PDFs address at all).

---

## 1. Product Vision

ELMADHI does not hand a user a plan. It runs a short interview, explains its reasoning in plain
language, and hands over an editable plan the user can keep pushing on. The three pillars already
named in `architecture.md` stand: **Diet Maker**, **Workout Maker**, **Q&A Library**. What this
document adds is the *reasoning layer* underneath the first two — the part that decides, given a
specific person's constraints, which of several defensible options to hand them, and how to say why.

The product is not trying to out-science a real coach. It is trying to be a better default than
"copy a plan off Instagram" for someone who cannot afford or does not want a human coach — while
being honest, in the rationale copy itself, about being a starting point ("this is a good default,
not gospel" — a line taken directly from the workout PDF's own philosophy section).

## 2. User Journey

```
Landing → Checkout (bank transfer / D17, WhatsApp confirm) → Admin activates → Sign up/in
  → Dashboard (3 pillar cards: Diet · Workout · Q&A)
    → Diet Maker:   Core questions → [optional deep-dive] → Strategy explanation → Editable plan
    → Workout Maker: Core questions → [optional deep-dive] → Split explanation → Editable program
    → Q&A:          Category chips → swipeable card feed → detail view
  → Settings (language toggle EN/TN, redo goals, sign out)
```

The mockups already show this almost exactly: bottom nav (Home / Workouts / Nutrition / Q&A /
Profile), a 4-step Diet Maker progress bar (Goal → Targets → Meals → Review), a macro ring, and a
Q&A grid with category chips (Nutrition / Training / Recovery / Supplements). Build to that, not to
a new visual system — the fourth "Review" step aligns with what `architecture.md` calls the
rationale screen; keep that name in code, "Review" in UI copy.

## 3. Personalization Engine — architecture

Three layers, each doing one job. This is the core design decision of this document, and it
directly answers the brief's "convert PDF knowledge into structured logic" request:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HARD FILTERS  (safety & feasibility — never violated)     │
│    injuries, equipment access, allergies, religious/dietary  │
│    restrictions, budget floor                                │
├─────────────────────────────────────────────────────────────┤
│ 2. STRATEGY SELECTION  (which named plan template applies)   │
│    goal + experience + days/week + body-fat context          │
│    → e.g. "3-day PPL" or "cut, normal pace, 3 meals/day"     │
├─────────────────────────────────────────────────────────────┤
│ 3. SOFT SCORING  (personalizes within the chosen template)   │
│    favorite/hated exercises & foods, cooking skill, budget   │
│    tier, weak-muscle emphasis                                │
└─────────────────────────────────────────────────────────────┘
```

**Why three layers instead of one nested `IF/THEN` tree:** a single flat decision tree with 20+
input variables blows up combinatorially and becomes unreadable and untestable (the classic
"if beginner AND overweight AND knee pain AND home AND dumbbells THEN…" example in the brief is
already 4 conditions for one exercise decision — multiply that across 80 exercises and 30 inputs
and it's unmaintainable by anyone, including an admin). Layer 1 is a hard filter (a `WHERE` clause,
essentially) applied once to the exercise/food catalog. Layer 2 is a small, enumerable lookup table
(there are only so many valid split×goal×experience combos — `architecture.md` already lists 6
templates, this document expands that table, it doesn't reinvent the shape). Layer 3 is scoring,
not branching — sort by preference match, don't write a new `if` for every preference. This is the
one structural change this blueprint makes to `architecture.md` §5's algorithms.

Every decision must remain explainable per the brief's requirement — that's satisfied because each
layer produces a small structured trace (which filters removed what, which template matched, which
scores broke ties), and the rationale screen renders that trace in plain language. No layer is a
black box or ML model; nothing here needs training data.

## 4. Decision Tree — exercise substitution (concrete, sourced from the PDF)

The workout PDF's "Exercise Variations" section (p.9–12) is already a clean substitution table,
not prose to interpret — this is the one part of the brief that PDFs answer directly and fully.
Reproduced as the Layer-1 filter data for the workout engine:

| Movement | Default (★ starter) | Alternatives |
|---|---|---|
| Incline press | Machine incline press | DB incline press, barbell incline, cable incline, Smith incline |
| Chest press | Machine chest press | DB bench, barbell bench, Smith bench |
| Chest flyes | Pec deck | Cable fly |
| Lat pulldown | Wide-grip pulldown | Neutral-grip pulldown, machine pulldown |
| Chest-supported row | Chest-supported machine row | Chest-supported DB row, T-bar row |
| Cable row | Close-grip cable row | Wide-grip cable row, single-arm cable row |
| Rear delt flyes | Cable rear delt fly | Pec-deck rear delt, DB rear delt fly |
| Shoulder press | Machine shoulder press | DB shoulder press, Smith press, barbell overhead press |
| Shrugs | Smith shrugs | DB shrugs, barbell shrugs, cable shrugs |
| Lateral raise | Cable lateral raise | DB lateral raise, machine lateral raise |
| Bicep curl | DB curl | Cable curl, EZ-bar curl, machine curl |
| Leg press | 45° leg press | Horizontal leg press, hack squat |
| Tricep extension (pushdown) | Rope pushdown | Bar pushdown, machine extension |
| Romanian deadlift | Barbell RDL | DB RDL, Smith RDL |
| Overhead tricep extension | Cable overhead extension | Machine overhead ext., DB overhead ext. |
| Leg extension | Machine leg extension | Single-leg extension |
| Hip abduction | Hip abduction machine | — |
| Leg curl | Seated leg curl | Lying leg curl, kneeling leg curl |
| Calf raise | Standing calf raise | Seated calf raise, leg-press calf raise |

This is precisely `exercises.equipment` + a new `exercise_group_id` (movement pattern group) in the
existing schema — group members share a target muscle and are interchangeable when the default is
unavailable or contraindicated. Add one column to `architecture.md`'s `exercises` table:
`substitution_group TEXT` (e.g. `'incline_press'`, `'leg_curl'`). The swap algorithm in
`architecture.md` §5 ("find same-muscle exercise not in contraindicated_for") becomes: filter
candidates to the same `substitution_group` first, fall back to same `primary_muscle` only if the
group has no clean option — tighter and matches the source material exactly.

The PDF's own "why machines first" philosophy (p.15, points 2–3) is a beginner-difficulty rule
worth encoding explicitly, since it's a real, source-backed rule the brief's example scenario
("beginner AND knee pain AND home AND dumbbells → avoid barbell squats") gestures at:

> **Rule W1 — beginner equipment bias.** For `experience = beginner`, prefer `equipment IN
> ('machine', 'cable')` substitution-group members over free-weight compounds for the first
> program version. Promote to free-weight variants automatically after the user logs ~8 sessions
> of the machine variant (post-MVP; for MVP, offer it as a manual "make it harder" toggle).
> **Why:** the source material explicitly recommends building stability and mind-muscle connection
> on controlled equipment before adding barbell-load coordination demands — not a made-up rule.

## 5. Diet Engine (grounded in the PDF's actual strategy logic)

The diet PDF does not give a food database (correctly noted in the brief) — it gives a **calorie
strategy decision table** with named tradeoffs. That table, transcribed faithfully, is the real
content of the diet engine's Layer 2:

| Strategy | Calorie adjustment | When it's the right call (per source) | Tradeoff |
|---|---|---|---|
| **Recomp** | Maintenance, or −100 to −200 kcal | Anyone at an already-acceptable weight, especially "skinny fat" (normal weight, higher body-fat%) who wants to lean out without a full cut/bulk cycle | Slowest visible change; requires high protein + high-intensity training + consistent tracking to actually see recomposition |
| **Cut — normal** | −500 kcal from TDEE | Default recommendation for beginners and most people; better long-term adherence and muscle retention | Slower fat loss than aggressive cut |
| **Cut — aggressive** | −1000 kcal from TDEE | Short timeline (event/deadline) or someone starting at high body-fat who wants to blitz through the top of the range fast, then switch to normal-cut pace | Lower training energy, higher muscle-loss risk, not sustainable past ~2 months, rebound risk — must not be offered as a long-term plan |
| **Bulk — clean** | +300 kcal from TDEE; add +200 more if weight is flat for 2 weeks | Default for most people, especially anyone who wants to stay reasonably lean while gaining | Slower absolute muscle gain than dirty bulk |
| **Bulk — dirty** | No calorie ceiling ("eat everything in front of you") | Only for already-lean people doing one deliberate hard bulk phase | Meaningfully worse fat-gain ratio, harder/longer subsequent cut, risk of the higher body-fat becoming the new normal if repeated |

Macro constants from the source (used in `calculateMacros()`, `architecture.md` §5, unchanged):
protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g; protein target 1.6–2.2 g/kg bodyweight; the PDF's
own worked example uses the same Mifflin-St-Jeor-style TDEE inputs already in the schema (sex, age,
height, weight, activity level) — no change needed there, it's already correct.

**Rule D1 — strategy gating.** Never surface "aggressive cut" or "dirty bulk" as the default
option; they are opt-in only, unlocked behind a one-line warning taken straight from the source
("not for more than ~2 months," "expect more fat gain and a harder cut after"). This is an explicit
product-safety decision this blueprint is adding on top of the source material, because the PDF
itself frames both as valid-but-costly choices, not defaults.

**Rule D2 — recomp default for ambiguous "tone up" goals.** If a user's stated goal doesn't cleanly
map to lose/gain (e.g. "I just want to look better," "reduce fat and build a bit of muscle"), route
to Recomp, not a guessed cut or bulk — this matches the source's own framing of who recomp is for.

Everything past this point — Ramadan adaptation, restaurant/family meals, student budgets,
Tunisian dish substitutions, allergy filtering — is **not in either PDF** and is standard
practice/product design, already scaffolded in `architecture.md` §3 (`budget_level`,
`dietary_restriction`, `allergies[]`) and §5 (meal-generation algorithm). No changes needed to that
logic; it's sound. The one addition worth making: a `ramadan_mode BOOLEAN` on `diet_profiles` that,
when true, collapses `meals_per_day` to 2 (suhoor/iftar) and shifts the meal-macro-split percentages
from breakfast/lunch/dinner to suhoor/iftar — a real Tunisian-market need the source material
doesn't cover but the product plainly needs.

## 6. Workout Engine

Split catalog, transcribed from the PDF and mapped onto `architecture.md`'s `program_templates`
table (this is the "6 templates" placeholder in v2, now filled in with the actual named options):

| Days/week | Option A | Option B |
|---|---|---|
| 2 | Full Body A/B | Upper/Lower |
| 3 | Push/Pull/Legs | "Arnold split" (Chest&Back / Shoulders&Arms / Legs) |
| 4 | Upper/Lower ×2 | — (source gives one) |
| 5 | PPL + Upper/Lower | Arnold + Upper/Lower |
| 6 | Arnold × PPL hybrid | 2× PPL (A/B) or 2× Arnold (A/B) |

Rep scheme is consistent across every template in the source and should be a global default, not
re-specified per template: **compound/primary lifts 2–3 × 8–10, isolation/accessory lifts 2 × 10–12.**

**Rule W2 — missed-session makeup (FAQ Q2/Q3, source-backed, not currently in `architecture.md`).**
If a user misses a scheduled day entirely, shift the remaining week forward by one day rather than
skipping or doubling up (Monday's session becomes Tuesday's, etc.); if only a mid-week forced rest
day conflicts, the whole week's start point can shift by a day while keeping day-type order intact.
This is a genuinely new feature relative to v2 — add a `program_schedule_shift` server action and a
"couldn't train today?" prompt on the dashboard.

**Rule W3 — deload/extra-rest signal (FAQ Q5, source-backed).** Suggest an extra rest day when any
of: no weight/rep increase in the last logged week, accumulating fatigue self-report, or
sleep/appetite disruption. Post-MVP (needs `workout_sessions`/`workout_sets` logging, which
`architecture.md` already schemas but defers) — flag as a V2 feature, not MVP, since MVP has no
logging UI yet per `master-prompt.md`'s explicit scope cut.

**Rule W4 — cardio guidance (FAQ Q7, source-backed).** If included: 20–30 min, after lifting (not
before), target HR ≈ 170 − age. Simple enough to render as a static Q&A card rather than a
generated recommendation — no personalization variable changes the number besides age.

Everything the brief asks for that the PDF doesn't cover — injury-specific contraindications beyond
what's implicit in equipment choice, RIR/RPE prescriptions, tempo, periodized progression schemes —
stays exactly as scoped in `architecture.md` §3/§5 (`contraindicated_for`, template exercises with
sets/rep_range/rest_seconds). That design was already reasonable; this document doesn't touch it.

## 7. Questionnaire Design

The brief asks for an exhaustive up-front questionnaire (30+ fields). That is worth pushing back on
directly (see §20), and the recommendation below reflects that pushback rather than delivering the
mega-form as specified.

**Structure: core (mandatory, ~90 seconds) + optional deep-dive (skippable, per pillar).**

*Diet Maker — core (unchanged from `architecture.md` §4, still correct):* sex, age, height, weight,
goal, activity level, meals/day, budget, allergies, dietary restriction, disliked foods. 11 steps.

*Diet Maker — optional deep-dive (new, surfaced as "Want a more precise plan?" after the core
flow, each individually skippable):* favorite foods (search + tag, feeds Layer-3 scoring), cooking
skill (`none|basic|comfortable` — gates whether recipes vs. raw-ingredient meals are suggested),
Ramadan mode toggle, family-meal mode ("I eat what my family cooks — help me fit macros around
that" — sets a flag that shifts the plan from prescriptive to a logging-against-target flow, a
different feature than plan generation, worth a V2 ticket not MVP).

*Workout Maker — core (unchanged from `architecture.md` §4, still correct):* goal, days/week,
session length, equipment, experience, injuries. 6 steps.

*Workout Maker — optional deep-dive (new):* favorite exercises (search, feeds Layer-3), hated
exercises (hard-excluded, not just deprioritized), weak muscle group emphasis (adds 1 extra set to
that muscle's exercises), consistency self-rating (feeds Rule W3's threshold once logging exists).

Everything else on the brief's list — occupation, travel frequency, motivation level, energy level,
religious restrictions beyond diet, previous diets/injuries as free history — either (a) doesn't
change any output the engine actually produces (no rule in §5/§6 consumes "motivation level"), or
(b) is already captured more usefully elsewhere (religious dietary restriction is already a diet
field; injuries already gate exercise selection). Asking for data with no consuming rule is a
UX cost with no personalization payoff — cut it. If a future rule needs it, add the question then.

## 8. Knowledge Engine (Q&A Library)

Matches the mockup closely already: category chips (Nutrition, Training, Recovery, Supplements —
`architecture.md`'s `qa_categories` needs a 4th category, `supplements`, added to the seed list),
card grid with icon + question + one-line answer + chevron to detail. The workout PDF's FAQ (7
Q&As) and diet PDF's implicit FAQs (recomp vs cut vs bulk explainer, "how do I use the AI prompt to
adjust my plan") are close to seed-ready content for `qa_cards` — real, sourced, beginner-appropriate
copy, better than inventing 15 placeholder cards from scratch as `architecture.md` §11 currently
plans. Use them as the first ~10 seed cards; the "Ask a question" CTA in the mockup (not in v2's
schema) implies a `qa_requests` table for user-submitted questions an admin can promote to a
published card — small addition, same pattern as the existing admin content-entry workflow.

## 9. Database Schema — deltas only

`architecture.md` §3 stands. Additions:

```sql
ALTER TABLE exercises ADD COLUMN substitution_group TEXT;
ALTER TABLE diet_profiles ADD COLUMN ramadan_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE diet_profiles ADD COLUMN cooking_skill TEXT CHECK (cooking_skill IN ('none','basic','comfortable'));
ALTER TABLE diet_profiles ADD COLUMN favorite_foods UUID[];         -- Layer-3 scoring input
ALTER TABLE training_profiles ADD COLUMN favorite_exercises UUID[]; -- Layer-3 scoring input
ALTER TABLE training_profiles ADD COLUMN weak_muscles TEXT[];
ALTER TABLE training_profiles ADD COLUMN consistency_self_rating INTEGER CHECK (consistency_self_rating BETWEEN 1 AND 5);

CREATE TABLE qa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','published','dismissed')),
  promoted_qa_card_id UUID REFERENCES qa_cards(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE qa_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_qa_requests" ON qa_requests FOR ALL USING (auth.uid() = user_id);
```

No `_fr` columns anywhere new; `architecture.md`'s existing `name_fr` columns on `foods`/`recipes`
are dead per `[[project_parallel_content_entry]]` and should be dropped in a future migration, not
carried forward.

## 10–12. Backend / Frontend / Folder Structure

Unchanged from `architecture.md` §8, with one addition: `lib/algorithms/` gets three new files
matching the three-layer design in §3 —

```
lib/algorithms/
├── macros.ts              # existing, unchanged
├── diet-strategy.ts        # NEW — Layer 2 for diet: strategy lookup table from §5
├── meal-plan-gen.ts        # existing, now consumes diet-strategy.ts's output + Layer 3 food scoring
├── program-match.ts        # existing, now filters via substitution_group (§4) before contraindicated_for
├── exercise-substitution.ts # NEW — Layer 1+3 for workout: group lookup + preference scoring
└── validation.ts           # existing, unchanged
```

Verify current `src/lib/`, `src/app/`, and `src/components/` structure against `architecture.md`
§8 before starting Phase 5/6 of `master-prompt.md` — the admin/auth/payment/i18n work already done
diverges slightly from the v2 folder sketch (e.g., `lib/action-result.ts`, `lib/auth.ts` exist and
aren't in the original plan); reconcile by extending what's there, not re-laying-out the tree.

## 13. UI/UX System

Confirmed, not redesigned, by today's mockups: dark background, card surfaces, lime-green accent,
bottom tab bar (Home/Workouts/Nutrition/Q&A/Profile), numbered step progress for wizards, a circular
macro ring, and meal/day accordions. This matches `architecture.md`'s color spec closely enough that
no palette change is needed. Two concrete additions the mockups reveal that aren't yet in any spec:
a notification bell (top-right, unread dot) — no backend for this exists; treat as decorative until
a real notification feature is scoped — and a "Can't find your answer? → Ask a question" CTA on the
Q&A screen, which maps to the new `qa_requests` table in §9.

## 14. Component Library

No changes to `architecture.md` §8's component list. Two new leaf components implied by this
document: `components/diet/ramadan-toggle.tsx` and `components/workout/missed-day-prompt.tsx`
(Rule W2). Everything else (macro ring, meal card, exercise card, program editor, Q&A feed/card)
already scoped.

## 15. Admin CMS

The brief asks for admins to "manage decision rules" and "version coaching logic" through a
no-code UI. Given the team is one founder plus one content-entry partner (`[[project_parallel_content_entry]]`),
building a rule-editing UI now is effort spent on a problem that doesn't exist yet — there are
currently ~2 rule tables (diet strategy lookup, split catalog) with single-digit row counts each.
Recommendation: keep decision tables (§5, §6) as versioned TypeScript/JSON config committed to git,
reviewed like code, until the ruleset is large enough (dozens of conditional branches) to justify a
UI. Extend the *existing* admin panel (`/admin/foods`, `/admin/exercises`) with two more tabs —
`/admin/program-templates` and `/admin/qa` (to triage `qa_requests`) — using the same
controlled-vocabulary form pattern already established, rather than building a generic rule editor.

## 16. Scalability Strategy

`architecture.md` §7 (caching) and §12 (perf checklist) stand unchanged — they were written for the
right load profile. Nothing in this document changes query patterns enough to need revisiting them.

## 17. Performance Optimizations

No changes to `architecture.md` §12. The one addition: Layer-1 hard filters (§3) should run as SQL
`WHERE` clauses at the query layer, not fetch-then-filter in application code — keeps the food/
exercise search fast at any catalog size instead of scaling filtering cost with table growth.

## 18. Future AI Features

The diet PDF's own closer (p.6) is itself an LLM-prompt template for generating a plan — a real
signal that a generative fallback has user-validated appeal. Worth scoping, explicitly as **V3, not
MVP**: an "ask AI to explain further" button on the rationale screen that pipes the user's structured
profile + the engine's decision trace (§3) into an LLM call for free-form Q&A, without ever letting
the LLM *decide* calories/exercises — the deterministic engine stays the source of truth, the LLM
only narrates. This preserves the "no magic, everything explainable" requirement from the brief.

## 19. Development Roadmap

Given real progress already made (auth, admin CMS, payment, i18n all shipped), the roadmap is not
`master-prompt.md`'s Phase 0–9 restarted — it's a continuation:

- **Now → MVP:** `master-prompt.md` Phases 4–8 (shared wizard component, Diet Maker, Workout Maker,
  Q&A, polish), built against §3's three-layer engine instead of v2's flatter algorithm sketch.
  Content entry (foods/exercises) continues in parallel per the existing workstream.
- **V1.5:** Ramadan mode, qa_requests triage, missed-session makeup (Rule W2).
- **V2:** workout logging UI (schema already exists), deload signal (Rule W3), weak-muscle emphasis
  scoring.
- **V3:** AI-narrated rationale (§18), admin rule-editor UI if/when the ruleset justifies it (§15).

## 20. Potential Weaknesses & Pushback

Direct answers to the brief's "challenge every assumption" instruction:

- **"Hundreds of thousands of users" is not this product's near-term reality**, and designing for
  it now (admin rule-versioning UI, elaborate scoring engines) trades MVP speed for scale the
  product doesn't have yet. `architecture.md` §14's own cost table tops out realistically around
  10–25k users on the current plan; that's the right scale to design for today.
- **The PDFs are thinner than the brief implies.** Treat them as good source for the diet-strategy
  table and the exercise-substitution table (both used verbatim above) — not as a comprehensive
  coaching corpus. Filling gaps (Ramadan, injuries beyond equipment, budget) required standard
  practice, not PDF mining, and is labeled as such throughout this document rather than presented
  as sourced when it isn't.
- **A 30+ question up-front questionnaire will hurt activation.** §7's core/deep-dive split exists
  specifically to avoid this — ask what every existing rule actually consumes, nothing more, and
  let power users opt into more precision.
- **A flat nested if/else rules engine doesn't scale past a handful of exercises.** §3's three-layer
  split (hard filter / template lookup / preference scoring) is the one architectural change this
  document makes versus the brief's literal ask, and it's the load-bearing decision in this whole
  document — everything else is detail under it.
- **Don't build a no-code rule editor before there are enough rules to need one** (§15) — reviewed
  config-as-code is faster to ship and just as auditable at current scale.
