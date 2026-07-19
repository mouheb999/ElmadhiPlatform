-- 018_live_sessions_progress.sql
-- Live in-progress workout sessions + weekly completion gating + progress
-- query support. A session row is now created when the user logs the first
-- set (completed_at IS NULL while training) and closed on finish, so a
-- workout survives navigation/reload/device switch. Additive + re-runnable.

-- =====================================================================
-- A. One open (in-progress) session per user at a time
-- ---------------------------------------------------------------------
-- Makes "resume" unambiguous and stops parallel half-sessions from two
-- devices. Safe on existing data: every historical row has completed_at set.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_user
  ON workout_sessions(user_id) WHERE completed_at IS NULL;

-- =====================================================================
-- B. Weekly completion lock — a program day is done once per week
-- ---------------------------------------------------------------------
-- Week = ISO week (Monday start) evaluated in Africa/Tunis (UTC+1, no DST).
-- timezone(text, timestamptz) and date_trunc(text, timestamp) are IMMUTABLE,
-- so the expression is legal in an index. Scoped to rows completed after the
-- feature ships so legacy duplicate completions can't fail the migration.
-- Keep the zone + week math in sync with src/lib/dates.ts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_completed_once_per_week
  ON workout_sessions (
    user_id,
    user_program_day_id,
    date_trunc('week', timezone('Africa/Tunis', completed_at))
  )
  WHERE completed_at IS NOT NULL
    AND completed_at >= '2026-07-18T00:00:00Z';

-- =====================================================================
-- C. Idempotent per-set logging
-- ---------------------------------------------------------------------
-- Sets are now inserted one-by-one from an offline-tolerant client outbox;
-- retries and cross-device double-taps must land on the same slot exactly
-- once. Pre-013 rows have NULL user_program_exercise_id and are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_unique_slot
  ON workout_sets (session_id, user_program_exercise_id, set_number)
  WHERE user_program_exercise_id IS NOT NULL;

-- =====================================================================
-- D. completed_at range scans (weekly gate + progress aggregations)
-- ---------------------------------------------------------------------
-- 013 indexed (user_id, started_at DESC) only; the gate and the /progress
-- charts filter on completed_at.
CREATE INDEX IF NOT EXISTS idx_sessions_user_completed
  ON workout_sessions(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Fetching a session's sets (resume hydration, finish summary, day stats).
CREATE INDEX IF NOT EXISTS idx_workout_sets_session
  ON workout_sets(session_id);

-- =====================================================================
-- E. Irreversibility, DB-enforced (same philosophy as the 013 lockdown)
-- ---------------------------------------------------------------------
-- A logged set is a historical fact: the client marks it done, it saves,
-- and it can never be edited or removed user-side. FK referential actions
-- (user_program_exercises ON DELETE SET NULL) run via RI triggers with
-- owner privileges, so program regeneration is unaffected.
REVOKE UPDATE, DELETE ON workout_sets FROM authenticated, anon;

-- Discarding is only legal for an EMPTY open session; backstop with a
-- trigger so a client can never wipe logged sets by deleting the parent.
-- Scoped to the `authenticated` role: RI cascades (account deletion via
-- profiles ON DELETE CASCADE) and service-role admin cleanup run as other
-- roles and must keep working.
CREATE OR REPLACE FUNCTION prevent_nonempty_session_delete() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', TRUE) = 'authenticated'
     AND EXISTS (SELECT 1 FROM public.workout_sets WHERE session_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete a session with logged sets';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_session_delete_guard ON workout_sessions;
CREATE TRIGGER on_session_delete_guard
  BEFORE DELETE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION prevent_nonempty_session_delete();
