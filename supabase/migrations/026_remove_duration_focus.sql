-- 026: exercise count no longer depends on session duration or body focus.
--
-- The generator now fills each day straight from split_day_slots — a day's
-- exercise count is fixed by its day type (which muscles it trains), never by
-- user input. The two questionnaire inputs that used to scale it are removed:
--   * session_duration  -> slot_count_adjustment_by_duration multiplier
--   * body_focus        -> body_focus_boost (+1 slot per focused muscle)

DELETE FROM questionnaire_questions WHERE id IN ('session_duration', 'body_focus');

DELETE FROM questionnaire_rules
  WHERE key IN ('slot_count_adjustment_by_duration', 'body_focus_boost');

-- training_profiles.session_duration and training_profiles.body_focus (plus
-- their CHECK constraints from migration 022) are deliberately NOT dropped:
-- historical profiles hold answers in them and existing generated programs
-- are untouched. The app stopped writing both columns. Once you're sure no
-- reporting reads them, drop them in a later migration:
--   ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_session_duration_check;
--   ALTER TABLE training_profiles DROP COLUMN IF EXISTS session_duration;
--   ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_body_focus_check;
--   ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_body_focus_max_check;
--   ALTER TABLE training_profiles DROP COLUMN IF EXISTS body_focus;
