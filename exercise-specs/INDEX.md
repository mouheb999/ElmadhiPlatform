# ELMADHI Exercise Specification Database

Source of truth for generating every exercise illustration. One file per exercise, organized by category folder. **214 exercises** across 12 categories.

| Category | Folder | Count |
|---|---|---|
| Back | `back/` | 26 |
| Chest | `chest/` | 18 |
| Shoulders | `shoulders/` | 20 |
| Biceps | `biceps/` | 16 |
| Triceps | `triceps/` | 16 |
| Forearms | `forearms/` | 6 |
| Legs (quads, hams, glutes, calves) | `legs/` | 32 |
| Core | `core/` | 20 |
| Cardio | `cardio/` | 10 |
| Home Workout | `home/` | 25 |
| Resistance Bands | `bands/` | 10 |
| Stretching & Mobility | `stretching/` | 15 |

All 80 exercises seeded in `supabase/seed.sql` are included (with their Arabic names).

## How illustrations are generated from a spec

Every image uses this master prompt, filled from the spec's YAML fields:

> Illustration asset only, NOT a UI design. Two identical anatomical écorché male figures side by side on a plain flat solid dark charcoal background (#161616), nothing else in frame. Absolutely NO text, NO labels, NO numbers, NO badges, NO panels, NO borders, NO frames, NO cards, NO interface elements. Clean minimal 3D medical-illustration style, gray-white body with subtle muscle striation. Exercise: **{name_en}**, viewed from **{camera}**. LEFT figure (start): **{start}**. RIGHT figure (finish): **{finish}**. Muscle highlighting: BRIGHT saturated green on **{primary}**. SOFT pale light green on **{secondary}**. NO green on **{avoid}**. Equipment (**{equipment}**) matte dark gray/near-black, minimal. Subtle soft green rim light only — no neon, no bright outlines, no gradients. Quiet, premium, minimal. **{notes}**

## Hard rules

1. Background is #161616 and is KEPT — never background-removed. It blends into the app's dark cards.
2. Figures centered with generous negative space so a 1:1 center-crop works for small thumbnails.
3. `avoid` and `mistakes` fields exist to stop the model's most common anatomical errors — include the NO-green list in every prompt.
4. For stretching: the green glow marks the *stretched* muscle, not a contraction.
5. For unilateral exercises: only the working side is highlighted.
6. Output file: `public/exercise-library/{category}/{id}.png`, 16:9, 2K.
