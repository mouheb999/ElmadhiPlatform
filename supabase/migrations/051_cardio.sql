-- 051_cardio.sql
-- The default cardio module: Speed Walking, for health and conditioning.
--
-- THE TWO RULES THIS SCHEMA EXISTS TO ENFORCE, both from the cardio sheet:
--
--   1. Cardio does not change the WORKOUT. Not the split, not the exercises,
--      not the sets, not the reps, not the progressive overload. So cardio does
--      NOT become a `user_program_exercises` row — that table is what the
--      progression engine reads, what `workout_sets` points at, and what the
--      muscle-coverage validator counts. A 30-minute walk with no sets and no
--      load would be a lie in every one of those. It gets its own table.
--
--   2. Cardio does not change the FOOD. "Cardio does NOT change the food
--      calories. Do NOT add burned calories back to the meal plan." So
--      `calories_burned` lands here, next to the session, and nothing in the
--      nutrition path reads this table. The number is shown to the user as
--      what they burned; `macro_targets` never sees it.
--
-- Burned calories use the standard MET equation:
--
--     kcal = MET × 3.5 × bodyweight_kg / 200 × minutes
--
-- which needs a MET per activity, hence `exercises.met_value`. It is stored on
-- the log row rather than recomputed on read, because bodyweight changes and a
-- walk done at 95 kg did not become a smaller walk when the user reached 88.
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. MET values for the cardio catalog
-- ============================================================
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS met_value NUMERIC(4,1);

COMMENT ON COLUMN exercises.met_value IS
  'Metabolic equivalent, for the burned-calorie estimate on cardio logs. NULL for strength and stretching, which are not estimated this way.';

-- Compendium-of-Physical-Activities values, rounded to one decimal.
UPDATE exercises SET met_value = v.met FROM (VALUES
  ('incline-treadmill-walk', 6.0),
  ('treadmill-run',          9.8),
  ('stationary-bike',        7.0),
  ('elliptical',             5.0),
  ('rowing-machine',         7.0),
  ('stair-climber',          9.0),
  ('jump-rope',             12.3),
  ('burpee',                 8.0),
  ('high-knees',             8.0),
  ('sprint-intervals',      12.0)
) AS v(slug, met) WHERE exercises.slug = v.slug;

-- ============================================================
-- 2. Speed Walking — the default, and the only one the app proposes
-- ============================================================
-- The catalog's nearest match was 'Incline Treadmill Walk', which is
-- equipment: machine. The sheet's default has to work for somebody with no gym
-- and no treadmill, so it is its own bodyweight row. `primary_muscle` and
-- `role` are NULL, as the two CHECK constraints require for a non-strength row.
INSERT INTO exercises (name_en, name_ar, exercise_type, equipment, primary_muscle, role, slug, met_value, instructions)
VALUES (
  'Speed Walking',
  'مشي سريع',
  'cardio',
  'bodyweight',
  NULL,
  NULL,
  'speed-walking',
  4.8,
  'Walk at a pace where you feel the effort but can still hold a conversation. On a treadmill that is about 5.5 to 6.5 km/h with 0 to 6 percent incline.'
)
ON CONFLICT (slug) DO UPDATE SET met_value = EXCLUDED.met_value;

-- ============================================================
-- 3. The plan: cardio attached to a program day
-- ============================================================
-- One block per day at most. The day is the anchor because that is where the
-- user attaches it ("after Push", "after Pull") and where the session that
-- records it already lives.
CREATE TABLE IF NOT EXISTS user_program_cardio (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_day_id UUID NOT NULL UNIQUE REFERENCES user_program_days(id) ON DELETE CASCADE,
  exercise_id         UUID NOT NULL REFERENCES exercises(id),
  minutes             INT  NOT NULL CHECK (minutes BETWEEN 5 AND 120),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_program_cardio ENABLE ROW LEVEL SECURITY;

-- Scoped through the day -> program -> user chain, the same shape
-- user_program_exercises uses.
DROP POLICY IF EXISTS user_program_cardio_own ON user_program_cardio;
CREATE POLICY user_program_cardio_own ON user_program_cardio
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_program_days d
      JOIN user_programs p ON p.id = d.user_program_id
      WHERE d.id = user_program_cardio.user_program_day_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_program_days d
      JOIN user_programs p ON p.id = d.user_program_id
      WHERE d.id = user_program_cardio.user_program_day_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 4. The record: cardio actually done in a session
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_cardio_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL UNIQUE REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES exercises(id),
  minutes         INT  NOT NULL CHECK (minutes BETWEEN 5 AND 120),
  -- Computed server-side from the MET value and the user's last known weight.
  -- Stored, not derived: a walk done at 95 kg did not shrink when they hit 88.
  calories_burned INT  NOT NULL CHECK (calories_burned >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_cardio_logs_session ON workout_cardio_logs(session_id);

ALTER TABLE workout_cardio_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_cardio_logs_own ON workout_cardio_logs;
CREATE POLICY workout_cardio_logs_own ON workout_cardio_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_sessions s
      WHERE s.id = workout_cardio_logs.session_id AND s.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions s
      WHERE s.id = workout_cardio_logs.session_id AND s.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
