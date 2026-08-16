-- 043_custom_plans.sql
-- Let a user build their own split and their own meal plan, instead of only
-- answering questions and being handed one.
--
-- The generators stay exactly as they are. Nothing here changes how a guided
-- plan is produced, and nothing here changes the logger: a custom program still
-- lands in user_programs / user_program_days / user_program_exercises, and a
-- custom meal plan still lands in meal_plans / meal_plan_meals / meal_plan_items.
-- The session recorder and the food diary read those same tables and cannot tell
-- the two apart, which is the point — one storage shape, two ways to fill it.
--
-- What actually needed schema:
--
--   1. A user-owned food. The catalog (nutrition_ingredients) is global and
--      read-only to users, so "add a food that isn't in the list" has nowhere to
--      go. `user_foods` existed from migration 003 until 028 dropped it outright
--      (CASCADE, along with the whole `foods` catalog) when meal plans were
--      repointed at the curated ingredient set. It is recreated here — same
--      name, but shaped like nutrition_ingredients rather than like the 003
--      version, so one picker can render both lists.
--
--   2. A marker for which way a plan was made, so the rationale screens can stop
--      claiming a hand-built plan was calculated.
--
-- Re-runnable. Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. user_foods: a private, per-user extension of the catalog
-- ============================================================
-- Column-for-column a nutrition_ingredients row plus an owner, because that is
-- what lets one picker list both and the diary log either. The unit_* columns
-- are here for the same reason: the plan renders servings ("2 eggs") next to
-- grams, and a user food that could not carry a unit would be a visibly
-- second-class row in the same list.
CREATE TABLE IF NOT EXISTS user_foods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  -- Nullable: this is one person's private label. Asking somebody to name their
  -- mother's couscous twice, once per language, to log it is absurd.
  name_ar           TEXT,
  slot              TEXT NOT NULL DEFAULT 'protein',
  calories_per_100g NUMERIC(6,1) NOT NULL,
  protein_per_100g  NUMERIC(5,1) NOT NULL,
  carbs_per_100g    NUMERIC(5,1) NOT NULL,
  fat_per_100g      NUMERIC(5,1) NOT NULL,
  fiber_per_100g    NUMERIC(5,1) NOT NULL DEFAULT 0,
  typical_serving_g NUMERIC(6,1),
  unit_en           TEXT,
  unit_en_plural    TEXT,
  unit_ar           TEXT,
  unit_ar_plural    TEXT,
  unit_grams        NUMERIC(6,1),
  -- Deleting a food that is already sitting in a plan or a logged day would
  -- take the history with it. Archiving hides it from the picker instead.
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Same vocabulary as nutrition_ingredients.slot, so one picker can list both.
ALTER TABLE user_foods DROP CONSTRAINT IF EXISTS user_foods_slot_check;
ALTER TABLE user_foods ADD CONSTRAINT user_foods_slot_check
  CHECK (slot IN ('protein','carb','vegetable','fat','fruit','legume','beverage'));

-- Owner-only, matching every other per-user table. The 008 policy of the same
-- name went away with the table when 028 dropped it, so it is recreated here
-- rather than assumed. Written with the auth.uid() subquery form migration 030
-- normalised everything else to, so it is not re-evaluated per row.
ALTER TABLE user_foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_user_foods" ON user_foods;
CREATE POLICY "own_user_foods" ON user_foods FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Per-100g values a human typed off a package. Bounds, not opinions: 900 kcal
-- is pure fat, and no food is more than 100 g of macro per 100 g of itself.
ALTER TABLE user_foods DROP CONSTRAINT IF EXISTS user_foods_macro_bounds_check;
ALTER TABLE user_foods ADD CONSTRAINT user_foods_macro_bounds_check
  CHECK (
    calories_per_100g >= 0 AND calories_per_100g <= 900
    AND protein_per_100g BETWEEN 0 AND 100
    AND carbs_per_100g   BETWEEN 0 AND 100
    AND fat_per_100g     BETWEEN 0 AND 100
  );

ALTER TABLE user_foods DROP CONSTRAINT IF EXISTS user_foods_name_check;
ALTER TABLE user_foods ADD CONSTRAINT user_foods_name_check
  CHECK (length(btrim(name)) BETWEEN 1 AND 80);

-- One person's private list is small; this is the only query that reads it.
CREATE INDEX IF NOT EXISTS idx_user_foods_user
  ON user_foods(user_id, created_at DESC)
  WHERE is_archived = FALSE;

-- Stops the same food being added twice by a user tapping "create" twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_foods_user_name
  ON user_foods(user_id, lower(btrim(name)))
  WHERE is_archived = FALSE;

-- ============================================================
-- 2. meal_plan_items: a plan row may point at a user food again
-- ============================================================
ALTER TABLE meal_plan_items
  ADD COLUMN IF NOT EXISTS user_food_id UUID REFERENCES user_foods(id) ON DELETE CASCADE;

-- Exactly one source per row. Without this a row could name both foods (which
-- macro is it?) or neither (a line with no food in it).
ALTER TABLE meal_plan_items DROP CONSTRAINT IF EXISTS meal_plan_items_one_source_check;
ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_one_source_check
  CHECK ((ingredient_id IS NOT NULL)::int + (user_food_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_meal_plan_items_user_food
  ON meal_plan_items(user_food_id) WHERE user_food_id IS NOT NULL;

-- ============================================================
-- 3. meal_logs: the diary can record one too
-- ============================================================
-- ON DELETE SET NULL, unlike the plan: a logged day is a record of what was
-- eaten. The macros are denormalized onto the row already, so losing the link
-- costs the name and nothing else.
ALTER TABLE meal_logs
  ADD COLUMN IF NOT EXISTS user_food_id UUID REFERENCES user_foods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_food
  ON meal_logs(user_food_id) WHERE user_food_id IS NOT NULL;

-- ============================================================
-- 4. RLS: a user food may only ever be referenced by its owner
-- ============================================================
-- The existing owner policies on meal_plan_items and meal_logs check that the
-- *row* belongs to the caller. They say nothing about what the row points at,
-- so a caller could paste somebody else's user_food_id into their own plan and
-- read back its name and macros through the join.
--
-- RESTRICTIVE, not permissive: permissive policies are OR'd together and would
-- have widened access rather than narrowed it. Restrictive ones are AND'ed with
-- everything already in force, which is what "and also this must hold" means.
-- service_role bypasses RLS entirely, so the admin panel is unaffected.

DROP POLICY IF EXISTS "meal_plan_items_own_user_food" ON meal_plan_items;
CREATE POLICY "meal_plan_items_own_user_food" ON meal_plan_items
  AS RESTRICTIVE FOR ALL
  USING (
    user_food_id IS NULL OR EXISTS (
      SELECT 1 FROM user_foods uf
      WHERE uf.id = meal_plan_items.user_food_id
        AND uf.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_food_id IS NULL OR EXISTS (
      SELECT 1 FROM user_foods uf
      WHERE uf.id = meal_plan_items.user_food_id
        AND uf.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "meal_logs_own_user_food" ON meal_logs;
CREATE POLICY "meal_logs_own_user_food" ON meal_logs
  AS RESTRICTIVE FOR ALL
  USING (
    user_food_id IS NULL OR EXISTS (
      SELECT 1 FROM user_foods uf
      WHERE uf.id = meal_logs.user_food_id
        AND uf.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_food_id IS NULL OR EXISTS (
      SELECT 1 FROM user_foods uf
      WHERE uf.id = meal_logs.user_food_id
        AND uf.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 5. How was this plan made?
-- ============================================================
-- /workout/rationale and /diet/rationale explain the reasoning behind a
-- generated plan. A hand-built one has no such reasoning, and showing the
-- generator's explanation over the top of it would be a straightforward lie.
ALTER TABLE user_programs
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

-- Kept on the profile as well as the plan: the profile is what a redo reads to
-- decide which flow to reopen, and it outlives any single plan version.
ALTER TABLE training_profiles
  ADD COLUMN IF NOT EXISTS build_mode TEXT NOT NULL DEFAULT 'guided';
ALTER TABLE training_profiles DROP CONSTRAINT IF EXISTS tp_build_mode_check;
ALTER TABLE training_profiles ADD CONSTRAINT tp_build_mode_check
  CHECK (build_mode IN ('guided', 'custom'));

ALTER TABLE diet_profiles
  ADD COLUMN IF NOT EXISTS build_mode TEXT NOT NULL DEFAULT 'guided';
ALTER TABLE diet_profiles DROP CONSTRAINT IF EXISTS dp_build_mode_check;
ALTER TABLE diet_profiles ADD CONSTRAINT dp_build_mode_check
  CHECK (build_mode IN ('guided', 'custom'));

-- ============================================================
-- 6. Room for a hand-built plan's shape
-- ============================================================
-- The guided wizard offers 3, 4 or 5 meals because those are the templates that
-- exist. Someone building by hand is not choosing a template, and two meals a
-- day is a real way to eat. Widening a CHECK cannot invalidate a stored row.
ALTER TABLE diet_profiles DROP CONSTRAINT IF EXISTS diet_profiles_meals_per_day_check;
ALTER TABLE diet_profiles ADD CONSTRAINT diet_profiles_meals_per_day_check
  CHECK (meals_per_day BETWEEN 1 AND 7);

-- The custom split builder deliberately keeps the 2-6 day range the rest of the
-- app already assumes (weekly gating, the dashboard's "days trained" maths), so
-- training_profiles.days_per_week is left exactly as it is.

-- The guided diet flow answers 20 questions and every one of them lands in a
-- NOT NULL-free column, so the short essentials wizard needs no relaxation
-- here either — it fills the nine the macro formula reads and leaves the rest
-- null, which is already legal.

COMMIT;
