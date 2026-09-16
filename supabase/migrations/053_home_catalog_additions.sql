-- 053_home_catalog_additions.sql
-- Two dumbbell movements the catalog was missing, both of them staples of a
-- home program.
--
-- They surfaced on a real complaint: a user who answered "Home only" with
-- dumbbells, bands and a pull-up bar was handed a machine-and-cable gym split.
-- Writing him the home program he asked for needed a horizontal press and a
-- hip hinge that a person can do with two dumbbells on a floor, and neither
-- existed — the nearest press was the Kettlebell Floor Press (equipment he
-- does not own) and the nearest hinge was the barbell Romanian Deadlift.
--
-- `dumbbell-rdl` is the id the spec sheet already uses
-- (exercise-specs/legs/dumbbell-rdl.md), and its illustration is already in
-- public/exercise-library/legs — the row was simply never inserted, so the
-- picture had no exercise to hang on. Keeping the slug means
-- `illustrationFor()` finds it with no manifest change.
--
-- Re-runnable: both rows key on the unique slug.

INSERT INTO exercises (
  name_en, name_ar, primary_muscle, equipment, difficulty, contraindicated_for,
  substitution_group, sub_target, exercise_type, role, slug, true_max_effort
) VALUES
  -- Floor press, not bench press: the floor stops the elbows below torso
  -- level, which is why it is the shoulder-friendly press to give somebody
  -- training at home with no bench.
  ('Dumbbell Floor Press', 'ضغط دمبل أرضي', 'chest', 'dumbbell', 'beginner',
   ARRAY[]::TEXT[], 'chest_horizontal_press', 'horizontal_press', 'strength',
   'mid_compound', 'dumbbell-floor-press', FALSE),
  -- Same hinge as the barbell RDL and the same lower-back caution, loaded with
  -- what a home lifter actually owns.
  ('Dumbbell RDL', 'رفعة رومانية دمبل', 'hamstrings', 'dumbbell', 'intermediate',
   ARRAY['Lower back']::TEXT[], 'hamstrings_hip_hinge', 'hip_hinge', 'strength',
   'opener_compound', 'dumbbell-rdl', FALSE)
ON CONFLICT (slug) DO UPDATE
  SET name_en             = EXCLUDED.name_en,
      name_ar             = EXCLUDED.name_ar,
      primary_muscle      = EXCLUDED.primary_muscle,
      equipment           = EXCLUDED.equipment,
      contraindicated_for = EXCLUDED.contraindicated_for,
      substitution_group  = EXCLUDED.substitution_group,
      sub_target          = EXCLUDED.sub_target,
      role                = EXCLUDED.role;
