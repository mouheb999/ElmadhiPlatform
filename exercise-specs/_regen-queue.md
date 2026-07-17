# Regeneration queue — flagged images

Updated 2026-07-17 after the Higgsfield regeneration batch (17 generations, nano_banana_2 @ 16:9 2k). All 14 flagged images were regenerated, verified visually, downloaded, and are live in `src/lib/exercise-illustrations.json`.

## Resolved this batch

- shoulders/machine-shoulder-press — deltoids now green, chest gray, complete machine
- shoulders/cable-external-rotation — correct movement arc, shoulder-only coloring
- shoulders/overhead-press — full deltoid caps green, dark background
- shoulders/cable-lateral-raise — true lateral raise, no text captions
- shoulders/handstand-push-up — distinct lockout start vs lowered finish
- shoulders/dumbbell-rear-delt-fly — dumbbells present in both hands in both poses
- shoulders/lateral-raise — chest gray (2nd attempt also fixed the hair/skin head from the 1st)
- shoulders/reverse-pec-deck — clean machine + distinct forward-start/swept-back-finish (2 attempts)
- back/pendlay-row — side-profile framing finally worked (3 attempts): plates on floor in start, bar at chest in finish
- back/landmine-row — side-profile framing (2 attempts): straight-arm start, handle rowed to ribs
- back/inverted-row — bar now racked in visible uprights
- chest/push-up — deep bottom position in start, écorché texture
- chest/wide-push-up — hands now visibly wider than shoulders
- chest/kettlebell-floor-press — single-hand grip throughout, other arm on floor

## Remaining polish (all minor, regenerate only if they bother in the app)

- **back/pendlay-row** — plates rendered light gray instead of the series' matte dark gray. If regenerating, append: "plates matte near-black like the rest of the series".
- **shoulders/cable-external-rotation** — small rust-brown patch on the rear-delt area (off the gray+green palette). Append: "only gray and green tones on the body, no brown or red".
- **chest/wide-push-up** — hand placement is wide but not the full 1.5× shoulder-width; heads slightly smoother than the écorché standard.
- **back/rack-pull** — contains small "START/FINISH" text captions unlike the rest of the series; otherwise correct.

## Prompting lessons (for future batches)

1. Rear-45° two-figure row compositions collapse into near-identical poses; DIRECT SIDE PROFILE framing makes start/finish differences render reliably (this is what fixed pendlay-row, landmine-row, and t-bar-row).
2. Coloring errors are always additions — pair every "X bright green" with an explicit "Y STAYS GRAY".
3. Name the single joint that must differ between panels ("straight vertical arms left, folded elbows right").
4. Specify "bald gray anatomical écorché head, no hair, no skin" or the model may render a realistic human head.

## Shared prefix

> Two anatomical écorché male figures side by side on a plain solid #161616 background, START pose on the left, FINISH pose on the right. Gray-white bodies with visible muscle striation, bald gray anatomical heads, clean 3D medical-illustration style. Primary muscles bright green (#22C55E), secondary muscles soft light green (~40% opacity). Equipment matte dark gray / near-black. Subtle soft green rim light only. No text, no labels, no UI, no borders. Figures centered with generous negative space. Illustration only.

## After regenerating

Swap new filenames into each category's `_images.json`, then run `scripts\download-exercise-images.ps1 <category>`.
