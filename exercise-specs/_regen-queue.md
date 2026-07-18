# Regeneration queue — flagged images

Updated 2026-07-18. Library is at **127 illustrations** across back, biceps, chest, legs,
shoulders, triceps.

**Triceps is clean (16/16), audited strictly against spec.** Legs and biceps have known
outstanding defects listed below — do not treat them as done.

## Status by category

| Category | Count | Audited strictly? | Known defects |
|---|---|---|---|
| Triceps | 16 | yes | none |
| Legs | 32 | yes | 8 (below) |
| Biceps | 16 | yes | 6 (below) |
| Back | 25 of 26 | no | meadows-row missing entirely |
| Chest | 18 | no | unknown — never audited |
| Shoulders | 20 | no | unknown — never audited |

A note on the audit: the first legs pass graded images against each other rather than against
the spec text, so borderline failures got waved through. The strict re-audit found 8 additional
defects in a batch previously reported as complete. Grade every image against its own spec
wording, not against how it compares to the other images in the batch.

## Outstanding — legs (8)

- **wall-sit** — both panels are the same 90° position; no start/finish distinction at all.
- **good-morning** — START panel has essentially no green; spinal erectors, a named primary, are
  never green in either panel.
- **single-leg-press** — START panel appears to show both feet on the platform.
- **glute-bridge** — hips never rest on the ground in START; both panels are mid-bridge.
- **hip-thrust** — glute green is a sliver despite being "the star"; bar reads dumbbell-like;
  START hips not dropped low.
- **standing-calf-raise** — heel travel too small, and the machine reads as an overhead pull-up
  bar rather than shoulder pads.
- **seated-calf-raise** / **dumbbell-calf-raise** — heel difference too subtle to read as the
  exercise; faint green tint on the step block.

## Outstanding — biceps (6)

- **spider-curl** — upper arms rest on the bench pad; spec requires them hanging completely free.
  As rendered it is a preacher curl.
- **chin-up** — grip is overhand, making it a pull-up. Spec explicitly forbids this.
- **incline-dumbbell-curl** — START panel is missing a dumbbell (left hand empty); only one arm
  colored.
- **reverse-curl**, **rope-hammer-curl**, **hammer-curl** — coloring inverted. These are
  forearm/brachialis exercises: spec puts biceps at 40% and the outer arm / thumb-side forearm
  ridge as the bright star. All three light up the biceps instead.

## Outstanding — other

- **back/meadows-row** — spec exists, no image, no manifest entry. Back is 25/26.
- **Equipment green tint** — hack-squat, leg-press, single-leg-press, glute-ham-raise and the
  cable machines carry a faint green rim glow on the frames. Subtle but systematic.

## Prompting lessons (cumulative)

1. **Describe the target muscle by LOCATION, not just by name.** This is what fixed the five
   triceps compounds where green landed on the chest. "The back of the upper arm, the posterior
   surface between shoulder and elbow, on the side facing away from the chest" works where
   "triceps" alone failed every time. Pair it with an explicit negation naming the muscle the
   model keeps choosing: "the pectoral is NOT the target and must carry no color at all."
2. Coloring errors are always additions — pair every "X bright green" with an explicit "Y STAYS
   GRAY". For unilateral lifts, enumerate the idle limb part by part ("left shoulder gray, left
   upper arm gray, left forearm gray, left hand gray") — a single "only the right arm" is not
   enough; the model mirrors the highlight.
3. **A strict side profile hides the far arm** and the two arms fuse into one limb. For lying
   bench work, raise the camera to ~30° above the bench so both arms are visible as separate
   limbs, and say so explicitly.
4. Spell out equipment dimensions or you get stubs: "a long straight shaft extending well beyond
   the body on both sides, with a large round plate near each end" — otherwise a barbell renders
   as a short dumbbell-like handle.
5. Name the single joint that must differ between panels.
6. **Small-ROM isolation lifts (calf raises, abduction) are the highest-risk category** — the two
   panels collapse into one pose unless you name the moving joint AND describe both end positions
   in concrete physical terms. "Foot nearly vertical, ankle fully pointed, whole body noticeably
   taller" works; "heels raised high" does not. Note this is still only partly solved — see the
   outstanding calf raises above.
7. When a pose must start at rest, say what is TOUCHING THE GROUND.
8. To exclude stray equipment, enumerate the exclusion ("NO BENCH, no rack, no other equipment of
   any kind"), not just what should be present.
9. Equipment that is normally colorful (bands, ropes) needs an explicit "NEVER green — only
   muscles may be green", or it inherits the highlight color.
10. Specify "bald gray anatomical écorché head, no hair, no skin" or a realistic head may appear.
11. State the background rule aggressively; add "NO VISIBLE FLOOR OR GROUND PLANE" for floor-based
    poses or a gray floor slab appears.
12. Text captions leak in occasionally. If one appears, escalate to a dedicated paragraph:
    "ABSOLUTELY NO TEXT. Do not write the words START or FINISH."

## Approaches tried and rejected

**Single-pose generation + code compositing.** Generating START and FINISH as separate images and
compositing them side by side was tried to solve the pose-collapse problem. It produces a visibly
seamed image that reads as *two small cards* rather than the library's single continuous frame —
each generation brings its own slightly different background tone, and fitting them into
half-slots leaves letterbox borders. Making it seamless would require background removal /
cutouts, which changes the art style. **The library standard is one two-figure generation per
exercise.** Keep it that way.

## Generation settings (important)

`generate_image` with `model: nano_banana_2` **silently defaults to 1k** — pass
`resolution: "2k"` explicitly or you get 1344×768 instead of 2752×1536. The API echoes the model
back as `nano_banana_flash`; that is the backend serving name, not a substitution. Always confirm
`width`/`height` on the completed job before accepting a batch.

Every card is 16:9, 2752×1536, optimized to a 1376×768 WebP. Keep new images on that geometry.

## Shared prefix

> Two anatomical écorché male figures side by side on a plain solid #161616 background, START pose on the left, FINISH pose on the right. Gray-white bodies with visible muscle striation, bald gray anatomical heads, clean 3D medical-illustration style. Primary muscles bright green (#22C55E), secondary muscles soft light green (~40% opacity). Equipment matte dark gray / near-black with no green tint or rim glow. No text, no labels, no UI, no borders. Figures centered with generous negative space. Illustration only.

## After regenerating

Swap new filenames into each category's `_images.json`, then run `scripts\download-exercise-images.ps1 <category>`.
