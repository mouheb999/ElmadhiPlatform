-- 045_paywall_in_rls.sql
-- Put the paywall next to the data, not only in front of it.
--
-- THE PROBLEM
--
-- Every paid Server Function opens with `requirePaidUser()`, and `proxy.ts`
-- gates the paid routes. Both are real, and neither is the boundary.
--
-- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is, by construction, public — it ships in the
-- client bundle. The signed-in user's access token is in their own cookies. So
-- anyone with a browser console can talk to PostgREST directly, as themselves,
-- without going through a single line of our code:
--
--     POST /rest/v1/meal_logs
--     apikey: <the anon key from the bundle>
--     Authorization: Bearer <their own access token>
--     { "user_id": "<their id>", "calories": 500, ... }
--
-- RLS on `meal_logs` is `FOR ALL USING (auth.uid() = user_id)` — that insert is
-- their own row, so it succeeds. The same held for workout_sessions,
-- workout_sets, daily_checkins, food_favorites, qa_requests and
-- plan_adaptations. Which is to say: every paid feature of the product was
-- reachable, for free, by anyone willing to open dev tools.
--
-- This was survivable while everything sat behind the paywall, because an
-- unpaid account could not get far enough in to have a reason to try. The
-- reverse trial is what made it matter: the whole design now hands a free
-- account a finished plan and asks it to pay only to *record* against it. The
-- recording is the product. If the recording is enforced only in a Server
-- Function, the product is free to anyone who reads one bundle.
--
-- A closely related hole, same cause: RLS let a user DELETE their own
-- `training_profiles` / `diet_profiles` rows, and the monthly rebuild quota
-- (migration 033) is counted by counting exactly those rows. Deleting them
-- reset the quota to zero.
--
-- THE FIX
--
-- RESTRICTIVE policies, AND-ed with the ownership policies already in force. A
-- permissive policy would have been OR-ed alongside them and widened access;
-- restrictive is the only shape that means "and also this must hold".
--
-- Scoped to writes only. SELECT is deliberately untouched: somebody whose
-- subscription lapsed must still be able to read the history they paid to
-- create, and blocking that would break screens for a customer who is about to
-- renew rather than for an attacker.
--
-- service_role bypasses RLS entirely, so nothing in the admin panel, the
-- payment webhook or any migration is affected.
--
-- Re-runnable.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The predicate
-- ---------------------------------------------------------------------------
-- Mirrors `isSubscriptionActive` in src/lib/subscription.ts exactly, including
-- the two things that look like oversights and are not:
--   * an admin always passes, so the person confirming payments is never
--     locked out of the app they are confirming them for;
--   * a NULL `plan_expires_at` on an active row counts as no expiry, for the
--     accounts activated before subscriptions had terms.
-- If that function changes, this changes with it.
--
-- Takes no argument on purpose. A `subscribed(uid)` form would be callable
-- over PostgREST RPC with somebody else's id, turning a policy helper into a
-- "is this person a customer?" oracle. Reading auth.uid() internally means the
-- only account it can answer for is the caller's own.
--
-- SECURITY DEFINER so the lookup does not itself depend on the caller's RLS on
-- `profiles`, and STABLE so Postgres may evaluate it once per statement.
CREATE OR REPLACE FUNCTION public.current_user_is_subscribed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.is_admin
        OR (p.payment_status = 'active'
            AND (p.plan_expires_at IS NULL OR p.plan_expires_at > NOW()))
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ), FALSE);
$$;

-- Needed because a RESTRICTIVE policy is evaluated as the calling role.
GRANT EXECUTE ON FUNCTION public.current_user_is_subscribed() TO authenticated;
-- Signed-out callers have no rows to reach anyway; no grant to anon.

-- ---------------------------------------------------------------------------
-- 2. Apply it to every table a paid action writes
-- ---------------------------------------------------------------------------
-- One block per table rather than a loop, so the command list per table is
-- readable and auditable — this is the file somebody reads when a paying user
-- reports "I can't log anything".
--
-- The predicate is wrapped in a scalar subquery for the same reason migration
-- 030 wrapped every auth.uid(): as an InitPlan it is evaluated once per
-- statement instead of once per row.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      -- The food diary. logFood / logPlanMeal / logQuick / copyPreviousDay /
      -- removeMealLog are all requirePaidUser.
      ('meal_logs',        ARRAY['INSERT','UPDATE','DELETE']),
      -- Recording a workout: startSession, logSet, finishSession.
      ('workout_sessions', ARRAY['INSERT','UPDATE','DELETE']),
      -- Migration 018 already revoked UPDATE and DELETE here.
      ('workout_sets',     ARRAY['INSERT']),
      -- The morning check-in. Upsert, so INSERT and UPDATE both.
      ('daily_checkins',   ARRAY['INSERT','UPDATE','DELETE']),
      -- Starring a food is part of the diary.
      ('food_favorites',   ARRAY['INSERT','DELETE']),
      -- Asking a question. UPDATE is already column-limited to
      -- answered_seen_at (migration 013), which a lapsed user may still set.
      ('qa_requests',      ARRAY['INSERT']),
      -- Accepting a coach adaptation.
      ('plan_adaptations', ARRAY['INSERT','UPDATE'])
    ) AS t(table_name, commands)
  LOOP
    FOR i IN 1 .. array_length(rec.commands, 1) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
        'paid_only_' || lower(rec.commands[i]), rec.table_name);

      -- INSERT policies carry only WITH CHECK; DELETE only USING; UPDATE both.
      IF rec.commands[i] = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated'
          || ' WITH CHECK ((SELECT public.current_user_is_subscribed()))',
          'paid_only_insert', rec.table_name);
      ELSIF rec.commands[i] = 'DELETE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated'
          || ' USING ((SELECT public.current_user_is_subscribed()))',
          'paid_only_delete', rec.table_name);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated'
          || ' USING ((SELECT public.current_user_is_subscribed()))'
          || ' WITH CHECK ((SELECT public.current_user_is_subscribed()))',
          'paid_only_update', rec.table_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Close the rebuild-quota reset
-- ---------------------------------------------------------------------------
-- `getRedoQuota` and the trigger in migration 033 both count profile rows with
-- version > 1 created this month. RLS let a user delete their own rows, so
-- deleting the history reset the allowance — and profiles are versioned
-- precisely so nothing is ever destroyed.
--
-- Nothing in the app deletes these through a user session: the questionnaires
-- archive by setting is_active = FALSE, and the custom builders' rollback path
-- uses the service-role client so that it is unaffected by this.
REVOKE DELETE ON training_profiles FROM authenticated, anon;
REVOKE DELETE ON diet_profiles FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. Narrow what a user may rewrite on their own support ticket
-- ---------------------------------------------------------------------------
-- Migration 034 granted a blanket UPDATE so a user could mark a reply read and
-- close their own report, and judged the exposure acceptable. Migration 044
-- then added `payment_request_id` to the same table, which is now load-bearing:
-- it is what `sendPaymentMessage` resolves a thread by. A column whitelist is
-- the same guard `profiles` has had since 013, and costs nothing.
REVOKE UPDATE ON support_tickets FROM authenticated, anon;
GRANT UPDATE (status, user_seen_at, last_message_at) ON support_tickets TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Refuse to commit unless it took
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  applied INT;
BEGIN
  SELECT count(*) INTO applied
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'paid\_only\_%'
    AND permissive = 'RESTRICTIVE';

  -- 3 + 3 + 1 + 3 + 2 + 1 + 2 = 15
  IF applied <> 15 THEN
    RAISE EXCEPTION 'expected 15 paid-only policies, found % — rolling back', applied;
  END IF;

  RAISE NOTICE 'OK: the paywall is enforced in RLS on % policies.', applied;
END $$;

COMMIT;
