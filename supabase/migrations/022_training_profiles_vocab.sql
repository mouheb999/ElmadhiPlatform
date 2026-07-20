-- 022_training_profiles_vocab.sql
-- Migrates training_profiles from the pre-019 vocabulary to the one the
-- questionnaire actually speaks, and widens it from 6 answers to all 19.
--
-- Every CHECK below is generated directly from questionnaire_questions.options,
-- so the constraint and the rendered UI cannot drift apart.
--
-- DESTRUCTIVE: clears training_profiles. The 5 existing rows are test-account
-- profiles in the old vocabulary whose user_programs were already removed by
-- migration 019 — they are orphaned and cannot be translated forward.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

DELETE FROM training_profiles;

-- ---------- drop the old vocabulary ----------
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS training_profiles_goal_check;
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS training_profiles_experience_check;
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS training_profiles_equipment_check;

-- `equipment` collapsed four gym/home tiers into one enum. The questionnaire
-- now asks location + two multi-selects, so the single column is replaced.
ALTER TABLE training_profiles DROP COLUMN IF EXISTS equipment;

-- session_minutes superseded by the session_duration bucket.
ALTER TABLE training_profiles ALTER COLUMN session_minutes DROP NOT NULL;

-- ---------- new columns ----------
ALTER TABLE training_profiles
  ADD COLUMN IF NOT EXISTS session_duration TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS training_style TEXT,
  ADD COLUMN IF NOT EXISTS pullup_ability TEXT,
  ADD COLUMN IF NOT EXISTS age_bracket TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS pregnancy_status TEXT,
  ADD COLUMN IF NOT EXISTS weight_goal TEXT,
  ADD COLUMN IF NOT EXISTS cardio_preference TEXT,
  ADD COLUMN IF NOT EXISTS recovery_capacity TEXT,
  ADD COLUMN IF NOT EXISTS equipment_gym TEXT[],
  ADD COLUMN IF NOT EXISTS equipment_home TEXT[],
  ADD COLUMN IF NOT EXISTS lift_comfort TEXT[],
  ADD COLUMN IF NOT EXISTS body_focus TEXT[],
  ADD COLUMN IF NOT EXISTS exercise_dislikes TEXT[];

-- ---------- CHECKs generated from questionnaire_questions.options ----------
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_goal_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_goal_check
  CHECK (goal IS NULL OR goal IN ('Muscle growth (hypertrophy)', 'Strength', 'Fat loss', 'Body recomposition (lose fat + build muscle)', 'General fitness / home convenience'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_session_duration_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_session_duration_check
  CHECK (session_duration IS NULL OR session_duration IN ('30-40 min', '45-60 min', '60-90 min', '90+ min'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_location_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_location_check
  CHECK (location IS NULL OR location IN ('Gym only', 'Home only', 'Home + Gym (hybrid)'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_experience_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_experience_check
  CHECK (experience IS NULL OR experience IN ('Beginner (0-6 months)', 'Intermediate (6mo-2yrs)', 'Advanced (2+ yrs)'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_training_style_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_training_style_check
  CHECK (training_style IS NULL OR training_style IN ('Heavy weight, low reps (strength feel)', 'Moderate weight, moderate reps (balanced)', 'Lighter weight, high reps (pump / endurance feel)', 'Not sure — let my goal decide'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_pullup_ability_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_pullup_ability_check
  CHECK (pullup_ability IS NULL OR pullup_ability IN ('Can''t do a full one yet', '1-5', '6-12', '12+'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_age_bracket_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_age_bracket_check
  CHECK (age_bracket IS NULL OR age_bracket IN ('Under 18', '18-29', '30-45', '46-60', '60+'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_gender_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_gender_check
  CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Prefer not to say'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_pregnancy_status_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_pregnancy_status_check
  CHECK (pregnancy_status IS NULL OR pregnancy_status IN ('None', 'Pregnant', 'Postpartum (0-6 months)', 'Postpartum (6+ months)'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_weight_goal_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_weight_goal_check
  CHECK (weight_goal IS NULL OR weight_goal IN ('Lose fat', 'Maintain / tone', 'Gain muscle (bulk)'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_cardio_preference_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_cardio_preference_check
  CHECK (cardio_preference IS NULL OR cardio_preference IN ('None', 'Light (1-2x/week)', 'Moderate (3x/week)', 'High (4+/week)'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_recovery_capacity_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_recovery_capacity_check
  CHECK (recovery_capacity IS NULL OR recovery_capacity IN ('Good sleep, low stress', 'Okay — some off days', 'Poor sleep or high stress lately'));

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_equipment_gym_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_equipment_gym_check
  CHECK (equipment_gym IS NULL OR equipment_gym <@ ARRAY['Barbell', 'Dumbbells', 'Cable machines', 'Selectorized machines', 'Kettlebell']::TEXT[]);

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_equipment_home_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_equipment_home_check
  CHECK (equipment_home IS NULL OR equipment_home <@ ARRAY['Dumbbells', 'Resistance bands', 'Pull-up bar', 'Kettlebell', 'Bodyweight only']::TEXT[]);

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_lift_comfort_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_lift_comfort_check
  CHECK (lift_comfort IS NULL OR lift_comfort <@ ARRAY['None — comfortable with all of these', 'Back Squat', 'Deadlift', 'Overhead Press', 'Bent-Over Barbell Row', 'Bulgarian Split Squat']::TEXT[]);

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_injuries_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_injuries_check
  CHECK (injuries IS NULL OR injuries <@ ARRAY['None', 'Lower back', 'Knee', 'Shoulder', 'Wrist / elbow', 'Neck']::TEXT[]);

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_body_focus_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_body_focus_check
  CHECK (body_focus IS NULL OR body_focus <@ ARRAY['Balanced physique (no extra focus)', 'Glutes / Legs', 'Arms', 'Chest', 'Back / V-taper', 'Shoulders', 'Abs / core']::TEXT[]);
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_body_focus_max_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_body_focus_max_check
  CHECK (body_focus IS NULL OR array_length(body_focus, 1) <= 2);

ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_exercise_dislikes_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_exercise_dislikes_check
  CHECK (exercise_dislikes IS NULL OR exercise_dislikes <@ ARRAY['None — open to anything', 'Walking Lunge', 'Burpees', 'Deadlift', 'Overhead Press', 'Running-based cardio']::TEXT[]);

COMMIT;

-- ROLLBACK: pre-commit run ROLLBACK; instead of COMMIT;
-- Post-commit: drop the tp_* constraints and the added columns, then
--   ALTER TABLE training_profiles ADD COLUMN equipment TEXT NOT NULL DEFAULT 'full_gym'
--     CHECK (equipment IN ('full_gym','home_basic','home_advanced','bodyweight'));