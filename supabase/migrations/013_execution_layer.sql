-- 013_execution_layer.sql
-- V1.1 "the app becomes observable": the daily-execution data spine that the
-- Today screen, Workout Session Mode, morning check-in, weekly review (V1.5)
-- and adaptive coaching (V2) all read from. Additive + re-runnable.

-- =====================================================================
-- A. SECURITY: lock down privileged profile columns
-- ---------------------------------------------------------------------
-- The "own_profile" RLS policy (008) is FOR ALL, so until now any signed-in
-- user could UPDATE their own is_admin / has_paid / payment_status through
-- the REST API — self-service admin + free activation. Profile rows are
-- created by the SECURITY DEFINER trigger handle_new_user() (002) and all
-- admin/webhook writes use the service-role client, so authenticated users
-- only ever legitimately change their name and language.
REVOKE INSERT, UPDATE ON profiles FROM authenticated, anon;
GRANT UPDATE (full_name, locale, updated_at) ON profiles TO authenticated;

-- createPaymentRequest no longer flips payment_status from the client (the
-- column is now locked). Do it here instead: an "I've paid" click moves an
-- unpaid profile to the under-review state.
CREATE OR REPLACE FUNCTION handle_new_payment_request() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET payment_status = 'pending'
  WHERE id = NEW.user_id AND payment_status <> 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_request_created ON payment_requests;
CREATE TRIGGER on_payment_request_created
  AFTER INSERT ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION handle_new_payment_request();

-- =====================================================================
-- B. Morning check-in (weight / energy / sleep) — one row per user per day
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,1) CHECK (weight_kg BETWEEN 25 AND 350),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  sleep_hours NUMERIC(3,1) CHECK (sleep_hours BETWEEN 0 AND 16),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON daily_checkins(user_id, checkin_date DESC);

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_checkins" ON daily_checkins;
CREATE POLICY "own_checkins" ON daily_checkins
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================================
-- C. Meal logs — schema only for now (V1.5 builds the logging UI).
-- ---------------------------------------------------------------------
-- entry_method is designed for every planned input path up front (search,
-- recents, favorites, copy-yesterday, quick calories, templates, camera AI)
-- so V1.5/V3 only add UI + services, not schema. Macros are denormalized at
-- log time: a log is a historical fact and must survive food edits/deletes.
CREATE TABLE IF NOT EXISTS meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_slot TEXT CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  custom_name TEXT,
  quantity_g NUMERIC(7,1),
  calories NUMERIC(7,1) NOT NULL,
  protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  entry_method TEXT NOT NULL DEFAULT 'search'
    CHECK (entry_method IN ('search', 'recent', 'favorite', 'copy_yesterday',
                            'quick', 'template', 'barcode', 'voice', 'camera_ai')),
  -- Camera-AI provenance (V3): recognition confidence 0..1, NULL for manual.
  source_confidence NUMERIC(3,2) CHECK (source_confidence BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date
  ON meal_logs(user_id, log_date DESC);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_meal_logs" ON meal_logs;
CREATE POLICY "own_meal_logs" ON meal_logs
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================================
-- D. Workout logging extensions (tables exist since 004; add what the
--    session UI captures and what the habit/coach layers will query)
-- ---------------------------------------------------------------------
ALTER TABLE workout_sets
  -- Reps-in-reserve as entered by the user (rpe kept for compatibility).
  ADD COLUMN IF NOT EXISTS rir INTEGER CHECK (rir BETWEEN 0 AND 10),
  -- Which plan row this set executed, so adaptation can compare plan vs done.
  ADD COLUMN IF NOT EXISTS user_program_exercise_id UUID
    REFERENCES user_program_exercises(id) ON DELETE SET NULL;

ALTER TABLE workout_sessions
  -- Exercises the user explicitly skipped this session (habit-engine signal).
  ADD COLUMN IF NOT EXISTS skipped_exercise_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started
  ON workout_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise
  ON workout_sets(exercise_id, created_at DESC);

-- =====================================================================
-- E. Generic analytics event stream (append-only)
-- ---------------------------------------------------------------------
-- The hidden coaching layer: session_completed, checkin_submitted,
-- meal_logged, pr_hit, plan_regenerated… Consumers aggregate; they never
-- update or delete.
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_type
  ON events(user_id, event_type, created_at DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_events_insert" ON events;
CREATE POLICY "own_events_insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_events_select" ON events;
CREATE POLICY "own_events_select" ON events
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- F. Q&A triage: let users see (and dismiss) "your question was answered"
-- ---------------------------------------------------------------------
ALTER TABLE qa_requests
  ADD COLUMN IF NOT EXISTS answered_seen_at TIMESTAMPTZ;

-- Users may update ONLY the seen marker on their own requests; status and
-- promotion stay admin-side (service role).
REVOKE UPDATE ON qa_requests FROM authenticated, anon;
GRANT UPDATE (answered_seen_at) ON qa_requests TO authenticated;
DROP POLICY IF EXISTS "own_qa_requests_update" ON qa_requests;
CREATE POLICY "own_qa_requests_update" ON qa_requests
  FOR UPDATE USING (auth.uid() = user_id);
