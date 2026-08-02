-- verify_prod_security.sql
-- Read-only. Paste into the Supabase SQL editor for the PRODUCTION project and
-- read the four verdicts. Nothing here writes.
--
-- Run this before launch, and again after any migration batch.

-- =====================================================================
-- 1. THE ONE THAT MATTERS: are privileged profile columns locked?
-- ---------------------------------------------------------------------
-- Migration 008 created "own_profile" as FOR ALL USING (auth.uid() = id),
-- which by itself lets any signed-in user UPDATE their own row through the
-- public REST API — including is_admin, has_paid, payment_status and
-- plan_expires_at. Migration 013 is what closes that, by revoking UPDATE on
-- the table and granting it back on three harmless columns.
--
-- EXPECT exactly three rows: full_name, locale, updated_at.
-- ANY other column here — especially is_admin or payment_status — means 013
-- did not apply and the app is wide open: self-service admin, free forever.
SELECT
  'profiles UPDATE grants' AS check_name,
  column_name,
  grantee
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, column_name;

-- Belt and braces: no table-wide UPDATE/INSERT should survive on profiles.
-- EXPECT zero rows.
SELECT
  'profiles table-wide grants (expect none)' AS check_name,
  privilege_type,
  grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type IN ('UPDATE', 'INSERT')
  AND grantee IN ('authenticated', 'anon');

-- =====================================================================
-- 2. Is RLS actually on for every user-owned table?
-- ---------------------------------------------------------------------
-- EXPECT zero rows. A table listed here has policies that are not being
-- enforced, or no protection at all.
SELECT
  'RLS disabled (expect none)' AS check_name,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'diet_profiles', 'macro_targets', 'meal_plans',
    'meal_plan_meals', 'meal_plan_items', 'meal_logs', 'food_favorites',
    'training_profiles', 'user_programs', 'user_program_days',
    'user_program_exercises', 'workout_sessions', 'workout_sets',
    'daily_checkins', 'events', 'qa_requests', 'payment_requests',
    'support_tickets', 'support_messages'
  )
  AND NOT rowsecurity;

-- =====================================================================
-- 3. Did the quota triggers land?
-- ---------------------------------------------------------------------
-- EXPECT three rows: trg_ai_estimate_quota (037), trg_diet_profile_redo_quota
-- and trg_training_profile_redo_quota (033). A missing trg_ai_estimate_quota
-- means AI meal estimates are uncapped and the model bill has no ceiling.
SELECT
  'quota triggers' AS check_name,
  tgname AS trigger_name,
  relname AS on_table
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE NOT tgisinternal
  AND tgname IN (
    'trg_ai_estimate_quota',
    'trg_diet_profile_redo_quota',
    'trg_training_profile_redo_quota'
  )
ORDER BY tgname;

-- =====================================================================
-- 4. Which migrations are visibly present?
-- ---------------------------------------------------------------------
-- Spot-check for the batch marked "pending manual apply" in the project notes
-- (018, 027, 028, 033, 034, 037). Each row reports whether a table or trigger
-- that migration creates actually exists.
-- EXPECT every `present` to be true.
SELECT 'migration landmarks' AS check_name, m.migration, m.present FROM (
  VALUES
    ('018 live sessions',  to_regclass('public.workout_sets')        IS NOT NULL),
    ('027 fixed splits',   to_regclass('public.fixed_splits')        IS NOT NULL),
    ('028 nutrition tpl',  to_regclass('public.nutrition_ingredients') IS NOT NULL),
    ('031 qa cards',       to_regclass('public.qa_cards')            IS NOT NULL),
    ('034 support',        to_regclass('public.support_tickets')     IS NOT NULL),
    ('037 ai quota',       EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_estimate_quota'
    ))
) AS m(migration, present);
