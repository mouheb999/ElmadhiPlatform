-- 061_admins_unlimited.sql
-- Admins are not customers and should not hit customer limits.
--
-- The paywall and the sign-up trial already let admins through
-- (`current_user_is_subscribed()` checks is_admin first, and so does
-- `isSubscriptionActive` in the app). Three per-account caps did not:
--
--   * enforce_plan_redo_quota   — 3 plan rebuilds a month (migration 033)
--   * enforce_ai_estimate_quota — 30 AI meal estimates a day (migration 037)
--   * enforce_qa_request_quota  — the monthly Q&A question limit (migration 031)
--
-- Each one now returns early when the row belongs to an admin. The bodies are
-- otherwise exactly what is live, so customers see no change.
--
-- The app mirrors this in src/lib/plan-redo.ts and src/lib/qa.ts so the UI
-- does not show an admin a "no rebuilds left" wall the database would no
-- longer enforce.
--
-- Re-runnable.

BEGIN;

-- One lookup, shared by the three triggers. SECURITY DEFINER so it can read
-- profiles regardless of who fired the trigger; not callable over REST.
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = p_user_id), FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Plan rebuilds
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_plan_redo_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT INTEGER := 3;
  v_used  INTEGER;
BEGIN
  -- Onboarding is not a redo.
  IF COALESCE(NEW.version, 1) <= 1 THEN
    RETURN NEW;
  END IF;

  -- Admins rebuild as often as they need to.
  IF public.is_admin_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE user_id = $1 AND version > 1'
    || ' AND created_at >= date_trunc(''month'', NOW())',
    TG_TABLE_NAME
  ) INTO v_used USING NEW.user_id;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'plan_monthly_redo_exceeded: % of % rebuilds already used this month on %',
      v_used, v_limit, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- AI meal estimates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_ai_estimate_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT INTEGER := 30;
  v_day_start TIMESTAMPTZ;
  v_used INTEGER;
BEGIN
  IF NEW.event_type <> 'ai_estimate_requested' THEN
    RETURN NEW;
  END IF;

  -- Admins are not rationed.
  IF public.is_admin_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_day_start := timezone(
    'Africa/Tunis',
    date_trunc('day', timezone('Africa/Tunis', NOW()))
  );

  SELECT COUNT(*) INTO v_used
  FROM events
  WHERE user_id = NEW.user_id
    AND event_type = 'ai_estimate_requested'
    AND created_at >= v_day_start;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'ai_daily_estimate_exceeded: % of % estimates already used today',
      v_used, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Q&A questions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_qa_request_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  -- Admins can ask as many as they like.
  IF public.is_admin_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT monthly_question_limit INTO v_limit FROM qa_settings WHERE id = 1;
  IF v_limit IS NULL THEN
    v_limit := 3;
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM qa_requests
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('month', NOW());

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'qa_monthly_quota_exceeded: % of % questions already used this month', v_used, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Same lockdown as migration 047: trigger functions are not REST endpoints.
REVOKE ALL ON FUNCTION public.enforce_plan_redo_quota() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_ai_estimate_quota() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_qa_request_quota() FROM PUBLIC, anon, authenticated;

COMMIT;
