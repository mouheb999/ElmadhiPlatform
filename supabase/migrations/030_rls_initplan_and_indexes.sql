-- 030_rls_initplan_and_indexes.sql
-- Performance only. No policy grants anything it didn't already grant, and no
-- query returns a different row set. Safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- 1. Wrap auth.uid() in a scalar subquery inside every RLS policy.
-- ---------------------------------------------------------------------------
-- `auth.uid()` is a STABLE function that parses the request JWT. Written bare
-- as `auth.uid() = user_id`, Postgres re-evaluates it once PER ROW SCANNED.
-- Written as `(select auth.uid()) = user_id` it becomes an InitPlan: evaluated
-- exactly once per query and reused. The two are semantically identical, but
-- the cost gap widens with every row added — which is precisely the wall this
-- schema would hit as meal_logs, workout_sets and events grow.
--
-- Rewriting is done from the catalog rather than by hand so no policy is
-- missed and none is silently reworded: each policy is recreated from its own
-- stored expression with the single textual substitution applied.
--
-- The explicit transaction makes this all-or-nothing: if any rewrite fails to
-- parse, every policy is left exactly as it was. A policy is never dropped
-- without its replacement committing in the same breath.

BEGIN;

DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  stmt TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      -- Already-wrapped policies render as "( SELECT auth.uid() AS uid)" and
      -- are skipped, which is what makes this migration re-runnable.
      AND (
        (qual IS NOT NULL AND qual LIKE '%auth.uid()%'
           AND qual NOT LIKE '%SELECT auth.uid()%')
        OR (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%'
           AND with_check NOT LIKE '%SELECT auth.uid()%')
      )
  LOOP
    new_qual := replace(pol.qual, 'auth.uid()', '( SELECT auth.uid() )');
    new_check := replace(pol.with_check, 'auth.uid()', '( SELECT auth.uid() )');

    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      pol.cmd,
      array_to_string(pol.roles, ', ')
    );

    -- INSERT policies carry only WITH CHECK; SELECT and DELETE carry only USING.
    IF new_qual IS NOT NULL AND pol.cmd <> 'INSERT' THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL AND pol.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    RAISE NOTICE 'rewrote policy %.% -> %', pol.tablename, pol.policyname, stmt;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Indexes for filters the hot screens actually run and that nothing covers.
-- ---------------------------------------------------------------------------

-- /diet Today: the user's open favourites list, newest first.
CREATE INDEX IF NOT EXISTS idx_food_favorites_user_created
  ON food_favorites(user_id, created_at DESC);

-- /diet Today: "recents" — the last 40 catalog foods this user logged.
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_recent_ingredients
  ON meal_logs(user_id, logged_at DESC)
  WHERE ingredient_id IS NOT NULL;

-- /dashboard + /workout: the single open (unfinished) session per user. The
-- 018 index covers completed sessions only, so this lookup had no index at all.
CREATE INDEX IF NOT EXISTS idx_sessions_user_open
  ON workout_sessions(user_id)
  WHERE completed_at IS NULL;

-- /dashboard: unread answered Q&A badge. 011 indexed (status, created_at),
-- which does not help a per-user filter.
CREATE INDEX IF NOT EXISTS idx_qa_requests_user_status
  ON qa_requests(user_id, status);

-- /diet Plan + Today: a plan's meals in display order.
CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_plan_order
  ON meal_plan_meals(meal_plan_id, order_index);

-- Every program-day fetch filters on the parent program.
CREATE INDEX IF NOT EXISTS idx_user_program_days_program
  ON user_program_days(user_program_id, day_number);

-- ---------------------------------------------------------------------------
-- 3. Refuse to commit unless the rewrite actually took.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  leftover INT;
BEGIN
  SELECT count(*) INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual IS NOT NULL AND qual LIKE '%auth.uid()%'
         AND qual NOT LIKE '%SELECT auth.uid()%')
      OR (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%'
         AND with_check NOT LIKE '%SELECT auth.uid()%')
    );

  IF leftover > 0 THEN
    RAISE EXCEPTION
      '% policies still evaluate auth.uid() per row — rolling back', leftover;
  END IF;

  RAISE NOTICE 'OK: no policy re-evaluates auth.uid() per row.';
END $$;

COMMIT;
