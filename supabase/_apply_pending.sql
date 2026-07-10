-- =============================================================
-- ELMADHI — pending migrations 010-016, combined.
-- Paste into Supabase Dashboard → SQL Editor → Run.
-- Every statement is re-runnable: already-applied parts are no-ops.
-- =============================================================

-- >>>>>>>> supabase/migrations/010_food_images.sql >>>>>>>>

-- 010_food_images.sql
-- Image support for content tables + public storage buckets.

-- Foods get an image; exercises already have thumbnail_url/video_url.
ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public buckets for admin-uploaded content images. Uploads are performed by
-- the service-role client (bypasses storage RLS) after a server-side is_admin
-- check; public = TRUE lets the app render the images via getPublicUrl.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('food-images', 'food-images', TRUE),
  ('exercise-images', 'exercise-images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- >>>>>>>> supabase/migrations/011_personalization_engine.sql >>>>>>>>

-- 011_personalization_engine.sql
-- Schema deltas from personalization-engine.md §9 (three-layer decision engine:
-- hard filters / template lookup / preference scoring). Additive only.

-- ---------- Layer-1 filter data: exercise substitution groups ----------
-- Movement-pattern group (e.g. 'incline_press', 'leg_curl') from the source
-- material's equipment-substitution table. Exercises in the same group target
-- the same muscle and are interchangeable when the default is unavailable or
-- contraindicated. NULL until the admin/seed data assigns one.
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS substitution_group TEXT;

CREATE INDEX IF NOT EXISTS idx_exercises_substitution_group
  ON exercises(substitution_group);

-- ---------- Diet Maker deep-dive fields (optional questionnaire, §7) ----------
ALTER TABLE diet_profiles
  ADD COLUMN IF NOT EXISTS ramadan_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cooking_skill TEXT
    CHECK (cooking_skill IN ('none', 'basic', 'comfortable')),
  ADD COLUMN IF NOT EXISTS favorite_foods UUID[],
  -- Rule D1 (personalization-engine.md §5): the intensity within a goal.
  -- 'normal' is always the default; 'aggressive' (cut) and 'dirty' (bulk) are
  -- opt-in only, gated behind a warning in the UI, never pre-selected.
  ADD COLUMN IF NOT EXISTS diet_intensity TEXT NOT NULL DEFAULT 'normal'
    CHECK (diet_intensity IN ('normal', 'aggressive', 'clean', 'dirty'));

-- ---------- Workout Maker deep-dive fields (optional questionnaire, §7) ----------
ALTER TABLE training_profiles
  ADD COLUMN IF NOT EXISTS favorite_exercises UUID[],
  ADD COLUMN IF NOT EXISTS weak_muscles TEXT[],
  ADD COLUMN IF NOT EXISTS consistency_self_rating INTEGER
    CHECK (consistency_self_rating BETWEEN 1 AND 5);

-- ---------- Q&A user-submitted questions (§8) ----------
CREATE TABLE IF NOT EXISTS qa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'dismissed')),
  promoted_qa_card_id UUID REFERENCES qa_cards(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_requests_status
  ON qa_requests(status, created_at DESC);

ALTER TABLE qa_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_qa_requests_insert" ON qa_requests;
CREATE POLICY "own_qa_requests_insert" ON qa_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_qa_requests_select" ON qa_requests;
CREATE POLICY "own_qa_requests_select" ON qa_requests
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- Q&A: add the 4th category shown in the mockups ----------
INSERT INTO qa_categories (slug, name_en, name_ar, order_index)
VALUES ('supplements', 'Supplements', 'المكملات الغذائية', 4)
ON CONFLICT (slug) DO NOTHING;

-- >>>>>>>> supabase/migrations/012_substitution_groups.sql >>>>>>>>

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

-- >>>>>>>> supabase/migrations/013_execution_layer.sql >>>>>>>>

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

-- >>>>>>>> supabase/migrations/014_meal_logging.sql >>>>>>>>

-- 014_meal_logging.sql
-- V1.5 "the app becomes daily": food-diary support. meal_logs itself shipped
-- in 013; this adds the favorites store the quick-log paths read from.

CREATE TABLE IF NOT EXISTS food_favorites (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, food_id)
);

ALTER TABLE food_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_food_favorites" ON food_favorites;
CREATE POLICY "own_food_favorites" ON food_favorites
  FOR ALL USING (auth.uid() = user_id);

-- >>>>>>>> supabase/migrations/015_adaptations.sql >>>>>>>>

-- 015_adaptations.sql
-- V2 slice 1: the adaptation audit trail. Every automatic plan change the
-- rules engine makes (or proposes) is recorded here with its reason key and
-- before/after payload — this is what makes "why did my plan change?" always
-- answerable, and what enforces the one-adjustment-per-week cooldown.

CREATE TABLE IF NOT EXISTS plan_adaptations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diet', 'workout')),
  -- i18n key of the rule that fired (e.g. 'adapt.cut_stall'). The
  -- explanation shown to the user is this key's template, not free text.
  reason_key TEXT NOT NULL,
  -- Before/after numbers, e.g. {old_calories, new_calories, trend_kg, ...}
  payload JSONB NOT NULL DEFAULT '{}',
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_adaptations_user
  ON plan_adaptations(user_id, kind, applied_at DESC);

ALTER TABLE plan_adaptations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_adaptations_select" ON plan_adaptations;
CREATE POLICY "own_adaptations_select" ON plan_adaptations
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_adaptations_insert" ON plan_adaptations;
CREATE POLICY "own_adaptations_insert" ON plan_adaptations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- >>>>>>>> supabase/migrations/016_ai_estimates.sql >>>>>>>>

-- 016_ai_estimates.sql
-- AI calorie calculator: text-described AI estimates get their own
-- entry_method ('ai_estimate') so analytics can tell them apart from photo
-- recognition ('camera_ai'). Re-runnable.

ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_entry_method_check;
ALTER TABLE meal_logs ADD CONSTRAINT meal_logs_entry_method_check
  CHECK (entry_method IN ('search', 'recent', 'favorite', 'copy_yesterday',
                          'quick', 'template', 'barcode', 'voice',
                          'camera_ai', 'ai_estimate'));

-- >>>>>>>> supabase/migrations/017_subscriptions.sql >>>>>>>>

-- 017_subscriptions.sql
-- Pricing switch: one-time unlock → Standard/Premium subscriptions in
-- 1/3/6-month terms. The manual flow (method → WhatsApp → admin activates)
-- is unchanged; requests now carry the chosen plan and activation stamps a
-- tier + expiry on the profile. Re-runnable.

-- ---------- Plans (admin-editable prices; longer terms earn a discount) ----
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'premium')),
  months INTEGER NOT NULL CHECK (months IN (1, 3, 6)),
  price_tnd NUMERIC(8,2) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tier, months)
);

INSERT INTO subscription_plans (tier, months, price_tnd) VALUES
  ('standard', 1,  29),
  ('standard', 3,  69),   -- 23 DT/mo — save 21%
  ('standard', 6, 119),   -- ~19.9 DT/mo — save 32%
  ('premium',  1,  49),
  ('premium',  3, 129),   -- 43 DT/mo — save 12%
  ('premium',  6, 219)    -- 36.5 DT/mo — save 25%
ON CONFLICT (tier, months) DO NOTHING;

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_public_read" ON subscription_plans;
CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT USING (is_enabled = TRUE);

-- ---------- Requests carry the chosen plan ----------
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS plan_tier TEXT,
  ADD COLUMN IF NOT EXISTS plan_months INTEGER;

-- ---------- Profiles: allow the 'standard' tier ----------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IN ('free', 'standard', 'premium'));
