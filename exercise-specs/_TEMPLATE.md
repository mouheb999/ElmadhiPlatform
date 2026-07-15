# Exercise Spec Template

```yaml
id: kebab-case-slug
name_en: Exercise Name
name_ar: الاسم بالعربية
category: back | chest | shoulders | biceps | triceps | legs | core | cardio | home | bands | stretching
equipment: []
grip: ""
camera: ""            # e.g. rear 45°, side profile left
body_position: []
start: []
finish: []
primary_muscles: []    # bright green (#22C55E, full saturation)
secondary_muscles: []  # soft light green (~40% opacity green)
stabilizers: []        # optional, no highlight unless noted
do_not_highlight: []
common_ai_mistakes: []
rendering_notes: []
```

## Global rendering rules (apply to EVERY illustration)

- Output is an ILLUSTRATION ONLY — an asset, not a UI.
- Two anatomical écorché male figures side by side: START on the left, FINISH on the right.
- NO text, NO labels, NO numbers, NO badges, NO panels, NO borders, NO cards, NO backgrounds elements, NO UI of any kind.
- Gray-white body (écorché, visible muscle striation), clean 3D medical-illustration style.
- Primary muscles: bright green. Secondary muscles: softer, lighter green.
- Equipment: matte dark gray / near-black.
- Lighting: subtle soft green rim light only. No neon, no bright outlines, no heavy gradients.
- Generated on a plain solid #161616 background which is KEPT (no background removal — transparent PNGs clash with the UI). The image blends into the app because the background matches the card color.
- Figures centered with generous negative space so a square (1:1) center-crop still works for small thumbnails.
- Design language: Apple Fitness / Linear / Raycast — minimal, quiet, premium. The illustration is supporting content, never the focus.
