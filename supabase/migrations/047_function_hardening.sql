-- 047_function_hardening.sql
-- Close the gap between "what a function is for" and "who may call it".
--
-- Everything here came out of the pre-launch pass over the live database
-- (Supabase's own security advisor, plus a read of the grants). None of it is
-- an open door today — it is the set of doors that are unlocked because nobody
-- ever locked them, on a database that is about to have real customers behind
-- it.
--
-- Re-runnable, and safe to run while the app is serving traffic: it changes
-- privileges and function settings, never data.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Pin the search_path on every SECURITY DEFINER function
-- ---------------------------------------------------------------------------
-- A SECURITY DEFINER function runs with its owner's rights — here, the
-- database owner. With no `search_path` of its own it resolves unqualified
-- names using whatever the *calling* session has set, so any account able to
-- create an object earlier on that path can put its own `profiles` in front of
-- ours and have privileged code operate on it.
--
-- `anon` and `authenticated` cannot CREATE in `public` on this project, which
-- is why this is hardening rather than a live hole. It stops being true the
-- day somebody grants a role schema rights for something unrelated, and a
-- pinned path costs nothing.
--
-- The quota triggers and `current_user_is_subscribed` already set one; these
-- three predate the habit. `pg_temp` last is the standard form: a
-- temp-table shadow is the other half of the same trick.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_payment_request() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_nonempty_session_delete() SET search_path = public, pg_temp;
-- Not SECURITY DEFINER, so it carries the caller's rights and cannot be used
-- to reach past them — pinned anyway, so "every function in this schema has a
-- fixed path" is a rule with no exceptions to remember.
ALTER FUNCTION public.clear_payment_request_seen() SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Stop trigger functions being callable over the REST API
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on every new function to PUBLIC, and PostgREST
-- exposes what `anon` and `authenticated` may execute at /rest/v1/rpc/<name>.
-- So `handle_new_user`, the quota enforcers and the rest have been reachable
-- from the public internet with the anon key.
--
-- Calling them there fails — Postgres refuses to run a trigger function
-- outside a trigger — so nothing was exploitable. But "it errors out" is not a
-- security boundary, it is a coincidence of the return type, and these are the
-- functions that flip payment status and enforce spend limits. They have no
-- business being addressable.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'handle_new_user()',
    'handle_new_payment_request()',
    'clear_payment_request_seen()',
    'prevent_nonempty_session_delete()',
    'enforce_ai_estimate_quota()',
    'enforce_plan_redo_quota()',
    'enforce_qa_request_quota()'
  ] LOOP
    -- The triggers themselves are unaffected: a trigger runs as the table
    -- owner's privilege, not the caller's, so revoking EXECUTE from client
    -- roles does not stop a single INSERT that fires one.
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- The paywall predicate is a different case: RLS evaluates it as the calling
-- role, so `authenticated` must keep EXECUTE or every paid write breaks. It
-- only ever answers for `auth.uid()`, so it cannot be asked about anyone else
-- — but a signed-out caller has nothing to ask about at all.
REVOKE ALL ON FUNCTION public.current_user_is_subscribed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_subscribed() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. A payment request may only ask for a plan we actually sell
-- ---------------------------------------------------------------------------
-- `startPaymentRequest` reads tier, duration and price server-side from
-- `subscription_plans` so that the client sends nothing but a plan id. That is
-- the right shape, and it is also not a boundary: the anon key ships in the
-- browser bundle and RLS lets a signed-in user INSERT their own
-- `payment_requests` row directly, with whatever terms they care to type.
--
-- The admin panel then reads those terms back when it activates the account.
-- So a hand-made row asking for 24 months, with an amount beside it that looks
-- like the three-month price, was a subscription an admin would have granted
-- while believing the queue.
--
-- `activateRequest` now re-reads the duration from the plan table, which is
-- the boundary that matters. This is the other half: the row cannot describe a
-- plan that does not exist in the first place, so the admin queue stops being
-- able to show a fiction.
--
-- RESTRICTIVE, so it is AND-ed with `own_payment_requests_insert` rather than
-- widening anything. Amount is deliberately not checked: an admin may adjust
-- prices between somebody choosing a plan and paying for it.
DROP POLICY IF EXISTS real_plan_only_insert ON public.payment_requests;
CREATE POLICY real_plan_only_insert ON public.payment_requests
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (plan_tier IS NULL AND plan_months IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.subscription_plans p
      WHERE p.tier = plan_tier
        AND p.months = plan_months
        AND p.is_enabled
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Refuse to commit unless it took
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  unpinned INT;
  callable INT;
  policy_count INT;
BEGIN
  SELECT count(*) INTO unpinned
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'handle_new_payment_request',
                      'prevent_nonempty_session_delete', 'clear_payment_request_seen')
    AND p.proconfig IS NULL;
  IF unpinned <> 0 THEN
    RAISE EXCEPTION '% function(s) still have a mutable search_path — rolling back', unpinned;
  END IF;

  SELECT count(*) INTO callable
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'handle_new_payment_request',
                      'clear_payment_request_seen', 'prevent_nonempty_session_delete',
                      'enforce_ai_estimate_quota', 'enforce_plan_redo_quota',
                      'enforce_qa_request_quota')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF callable <> 0 THEN
    RAISE EXCEPTION '% trigger function(s) still callable over REST — rolling back', callable;
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'payment_requests'
    AND policyname = 'real_plan_only_insert' AND permissive = 'RESTRICTIVE';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'the plan-shape policy did not apply — rolling back';
  END IF;

  RAISE NOTICE 'OK: search paths pinned, trigger functions unreachable, plan shape enforced.';
END $$;

COMMIT;
