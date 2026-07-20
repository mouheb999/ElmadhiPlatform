-- 025_role_tag_fixes.sql
-- Corrections to migration 024's role derivation, surfaced by end-to-end runs
-- against the real catalog.
--
-- 1. Untag Hip Thrust and Sumo Deadlift from true_max_effort. They are heavy
--    barbell lifts but not technically demanding enough to justify hijacking
--    day-order the way Back Squat / Bench Press do. Real risk: Hip Thrust
--    (glutes) was jumping ahead of Back Squat (quads) on the Legs day.
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

UPDATE exercises
SET true_max_effort = FALSE,
    role = 'opener_compound'
WHERE slug IN ('hip-thrust', 'sumo-deadlift')
  AND true_max_effort = TRUE;

COMMIT;

-- ROLLBACK: pre-commit run ROLLBACK; instead of COMMIT;
-- Post-commit:
--   UPDATE exercises SET true_max_effort = TRUE, role = 'opener_heavy'
--   WHERE slug IN ('hip-thrust', 'sumo-deadlift');
