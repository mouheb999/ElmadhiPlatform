-- 029 — let the food diary mirror the meal plan.
--
-- The diary was built on four generic slots (breakfast/lunch/dinner/snack)
-- while the template engine generates up to seven eating occasions
-- (meal_1, snack, meal_2, pre_workout, post_workout, meal_3, last_meal).
-- Logging collapsed them lossily: meal_3 + last_meal both became "dinner",
-- and snack + pre_workout + post_workout all became "snack" — so a user with
-- a six-meal plan could only log into four buckets, none of which were named
-- after the meals they were actually told to eat.
--
-- Widen the constraint so a log can name the plan occasion it belongs to.
-- The four legacy values stay valid: historical rows keep their meaning, and
-- nothing has to be backfilled.

ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_meal_slot_check;

ALTER TABLE meal_logs ADD CONSTRAINT meal_logs_meal_slot_check
  CHECK (meal_slot IN (
    -- template meal keys (meal_template_slots.meal_key)
    'meal_1', 'snack', 'meal_2', 'meal_3',
    'pre_workout', 'post_workout', 'last_meal',
    -- legacy diary slots, kept for rows logged before this migration
    'breakfast', 'lunch', 'dinner',
    -- anything eaten outside the plan
    'other'
  ));

COMMENT ON COLUMN meal_logs.meal_slot IS
  'Eating occasion. Normally a template meal_key (meal_1, meal_2, pre_workout, …) matching the user''s plan; "other" for off-plan food; breakfast/lunch/dinner are legacy values from before migration 029.';
