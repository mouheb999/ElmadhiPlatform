-- 033_plan_redo_limit.sql
-- Three plan rebuilds per calendar month, counted separately for diet and
-- training.
--
-- Both questionnaires are versioned: answering them again archives the active
-- profile and inserts a new row with version = previous + 1. So "a redo" is
-- exactly "a profile row with version > 1", and first-time onboarding
-- (version 1) is never charged for.
--
-- The server actions check the same count first, because that is what produces
-- a readable message and stops the user before twenty questions. This trigger
-- is what actually holds: a Server Action is reachable by direct POST.
--
-- The limit is duplicated in src/lib/plan-redo.ts (MONTHLY_REDO_LIMIT) — the
-- two must be changed together.

CREATE OR REPLACE FUNCTION enforce_plan_redo_quota()
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

  -- One function, two tables: diet_profiles and training_profiles have the
  -- same three columns this needs, so the count is built from TG_TABLE_NAME
  -- rather than duplicating the body per table.
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

DROP TRIGGER IF EXISTS trg_diet_profile_redo_quota ON diet_profiles;
CREATE TRIGGER trg_diet_profile_redo_quota
  BEFORE INSERT ON diet_profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_redo_quota();

DROP TRIGGER IF EXISTS trg_training_profile_redo_quota ON training_profiles;
CREATE TRIGGER trg_training_profile_redo_quota
  BEFORE INSERT ON training_profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_redo_quota();

-- The trigger and the settings page both count the same narrow slice: this
-- user's rebuilds since the first of the month.
CREATE INDEX IF NOT EXISTS idx_diet_profiles_redos
  ON diet_profiles(user_id, created_at DESC) WHERE version > 1;

CREATE INDEX IF NOT EXISTS idx_training_profiles_redos
  ON training_profiles(user_id, created_at DESC) WHERE version > 1;
