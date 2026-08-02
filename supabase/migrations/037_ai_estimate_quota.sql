-- 037_ai_estimate_quota.sql
-- A daily ceiling on AI meal estimates, per user.
--
-- Why this is a database trigger and not just a check in the Server Function:
-- every other quota in this schema (Q&A asks, plan rebuilds — migrations 031
-- and 033) guards something that only costs us a row. This one guards a call
-- to a vision model on a metered API key. A Server Function is reachable by a
-- direct POST, so a check that lives only in `estimateMealAction` is a check an
-- attacker skips — and the bill is real money, arriving with no ceiling and no
-- warning.
--
-- The action therefore *reserves* the call by inserting its
-- `ai_estimate_requested` event BEFORE it talks to the provider. That insert is
-- what this trigger gates. Refuse the insert and the provider is never called,
-- whoever the caller is and however they got here.
--
-- The limit is duplicated in src/lib/ai-quota.ts (DAILY_AI_ESTIMATE_LIMIT) —
-- the two must be changed together.
--
-- Re-runnable.

CREATE OR REPLACE FUNCTION enforce_ai_estimate_quota()
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
  -- One trigger on a table that carries every other coaching event too, so the
  -- cheap type check comes first and everything else leaves untouched.
  IF NEW.event_type <> 'ai_estimate_requested' THEN
    RETURN NEW;
  END IF;

  -- Midnight Africa/Tunis as a real timestamptz. The app counts "today" in
  -- Tunis everywhere (src/lib/dates.ts); a UTC day here would hand users a
  -- second allowance in the hour after midnight.
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

DROP TRIGGER IF EXISTS trg_ai_estimate_quota ON events;
CREATE TRIGGER trg_ai_estimate_quota
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_ai_estimate_quota();

-- The count above is exactly the leading edge of idx_events_user_type
-- (user_id, event_type, created_at DESC) from migration 013, so it needs no
-- index of its own.
