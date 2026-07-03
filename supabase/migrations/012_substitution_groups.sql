-- 012_substitution_groups.sql
-- Backfill `substitution_group` (added in 011) on the exercises already
-- seeded in seed.sql, using the equivalence groups from
-- personalization-engine.md §4 (AbuzWorkoutSplits.pdf's variation table).
-- Group names are generic movement patterns, not tied to one equipment type,
-- since the seeded exercise names don't always match the PDF's exact labels.

UPDATE exercises SET substitution_group = 'chest_press' WHERE name_en IN
  ('Barbell Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press', 'Kettlebell Floor Press', 'Push-Up', 'Decline Push-Up');

UPDATE exercises SET substitution_group = 'incline_press' WHERE name_en IN
  ('Incline Dumbbell Press');

UPDATE exercises SET substitution_group = 'chest_fly' WHERE name_en IN
  ('Dumbbell Fly', 'Cable Crossover');

UPDATE exercises SET substitution_group = 'lat_pulldown' WHERE name_en IN
  ('Lat Pulldown', 'Pull-Up', 'Chin-Up', 'Dead Hang');

UPDATE exercises SET substitution_group = 'row' WHERE name_en IN
  ('Bent-Over Barbell Row', 'Dumbbell Row', 'Seated Cable Row', 'Inverted Row', 'Machine Row');

UPDATE exercises SET substitution_group = 'shoulder_press' WHERE name_en IN
  ('Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Machine Shoulder Press', 'Pike Push-Up');

UPDATE exercises SET substitution_group = 'lateral_raise' WHERE name_en IN
  ('Lateral Raise', 'Band Lateral Raise');

UPDATE exercises SET substitution_group = 'rear_delt' WHERE name_en IN
  ('Face Pull', 'Front Raise');

UPDATE exercises SET substitution_group = 'shrugs' WHERE name_en IN
  ('Farmer Carry');

UPDATE exercises SET substitution_group = 'bicep_curl' WHERE name_en IN
  ('Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Cable Curl', 'Band Curl');

UPDATE exercises SET substitution_group = 'tricep_pushdown' WHERE name_en IN
  ('Triceps Pushdown', 'Band Pushdown', 'Close-Grip Bench Press', 'Diamond Push-Up', 'Bench Dip');

UPDATE exercises SET substitution_group = 'overhead_tricep_extension' WHERE name_en IN
  ('Overhead Triceps Extension');

UPDATE exercises SET substitution_group = 'leg_press' WHERE name_en IN
  ('Leg Press', 'Back Squat', 'Front Squat', 'Goblet Squat', 'Bodyweight Squat', 'Wall Sit');

UPDATE exercises SET substitution_group = 'split_squat' WHERE name_en IN
  ('Bulgarian Split Squat', 'Walking Lunge', 'Step-Up');

UPDATE exercises SET substitution_group = 'leg_extension' WHERE name_en IN
  ('Leg Extension');

UPDATE exercises SET substitution_group = 'romanian_deadlift' WHERE name_en IN
  ('Romanian Deadlift', 'Dumbbell RDL', 'Good Morning', 'Deadlift');

UPDATE exercises SET substitution_group = 'leg_curl' WHERE name_en IN
  ('Lying Leg Curl', 'Nordic Curl', 'Glute-Ham Raise');

UPDATE exercises SET substitution_group = 'hip_abduction' WHERE name_en IN
  ('Banded Hip Abduction');

UPDATE exercises SET substitution_group = 'hip_thrust' WHERE name_en IN
  ('Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Cable Pull-Through');

UPDATE exercises SET substitution_group = 'calf_raise' WHERE name_en IN
  ('Standing Calf Raise', 'Seated Calf Raise', 'Bodyweight Calf Raise', 'Dumbbell Calf Raise');
