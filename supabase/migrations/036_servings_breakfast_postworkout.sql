-- 036_servings_breakfast_postworkout.sql
-- Three corrections to how the meal plan is built and presented.
--
-- A. HOUSEHOLD SERVINGS. Everything was priced in grams, including foods
--    nobody weighs. "150 g apple" is a number you cannot act on without a
--    scale; "1 apple" is. Foods that are naturally counted (eggs, fruit),
--    spooned (oil), poured (coffee) or bought by the pack (tuna) get a unit
--    and its gram weight, so the UI can say "1 apple" and keep 150 g beside it.
--    Staples that genuinely are weighed — rice, chicken, couscous, lentils —
--    keep grams alone, because that is how they are actually portioned.
--
-- B. BREAKFAST STAYS BREAKFAST. The templates were already right (Meal 1 is
--    eggs + carb + fat + coffee), but the substitution step was not: when a
--    user avoids eggs, resolveIngredient() pulled the next default from the
--    protein slot and served chicken breast at 7am. `breakfast_ok` marks which
--    foods may appear in Meal 1 at all, and the engine now filters by it.
--
-- C. POST-WORKOUT IS RETIRED. It was a two-item stub (usually a fruit, plus an
--    optional shake that is skipped by default) sitting between two real
--    meals. Its food moves into the next meal instead of vanishing — for the
--    templates below that is always Meal 3.

-- ===========================================================================
-- A. Serving units
-- ===========================================================================

ALTER TABLE nutrition_ingredients
  ADD COLUMN IF NOT EXISTS unit_en        TEXT,
  ADD COLUMN IF NOT EXISTS unit_en_plural TEXT,
  ADD COLUMN IF NOT EXISTS unit_ar        TEXT,
  ADD COLUMN IF NOT EXISTS unit_ar_plural TEXT,
  ADD COLUMN IF NOT EXISTS unit_grams     NUMERIC(6,1);

COMMENT ON COLUMN nutrition_ingredients.unit_grams IS
  'Grams in one household unit (1 egg = 50 g). NULL means this food is served by weight only.';

WITH units(id, unit_en, unit_en_plural, unit_ar, unit_ar_plural, grams) AS (VALUES
  -- counted whole
  ('eggs',        'egg',       'eggs',       'بيضة',   'بيضات',  50),
  ('apple',       'apple',     'apples',     'تفاحة',  'تفاحات', 150),
  ('banana',      'banana',    'bananas',    'موزة',   'موزات',  120),
  ('dates',       'date',      'dates',      'تمرة',   'تمرات',  8),
  ('olives',      'olive',     'olives',     'زيتونة', 'زيتونات', 4),
  -- sliced
  ('whole_wheat_bread', 'slice', 'slices',   'شريحة',  'شرايح',  40),
  ('watermelon',  'slice',     'slices',     'شريحة',  'شرايح',  300),
  -- spooned and poured
  ('olive_oil',   'tbsp',      'tbsp',       'ملعقة كبيرة', 'ملاعق كبيرة', 10),
  ('coffee',      'cup',       'cups',       'فنجان',  'فناجن',  200),
  -- by the handful
  ('peanuts',     'handful',   'handfuls',   'حفنة',   'حفنات',  30),
  ('almonds',     'handful',   'handfuls',   'حفنة',   'حفنات',  30),
  ('mixed_nuts',  'handful',   'handfuls',   'حفنة',   'حفنات',  30),
  ('parsley',     'handful',   'handfuls',   'حفنة',   'حفنات',  20),
  -- by the pack
  ('tuna',        'can',       'cans',       'علبة',   'علب',    120),
  ('sardines',    'can',       'cans',       'علبة',   'علب',    120),
  ('whey_protein','scoop',     'scoops',     'سكوب',   'سكوب',   30),
  ('protein_bar', 'bar',       'bars',       'بار',    'بارات',  60),
  -- served as a plate
  ('mixed_salad',       'plate', 'plates',   'طبق',    'أطباق',  200),
  ('cooked_vegetables', 'plate', 'plates',   'طبق',    'أطباق',  200)
)
UPDATE nutrition_ingredients n
SET unit_en        = u.unit_en,
    unit_en_plural = u.unit_en_plural,
    unit_ar        = u.unit_ar,
    unit_ar_plural = u.unit_ar_plural,
    unit_grams     = u.grams
FROM units u
WHERE n.id = u.id;

-- ===========================================================================
-- B. Breakfast-appropriate foods
-- ===========================================================================
-- Default TRUE so a food added later shows up rather than silently vanishing
-- from Meal 1; the list below is what must never appear at breakfast.
-- Kept deliberately Tunisian: bread with olive oil, eggs, oats, coffee, fruit,
-- nuts — plus fava beans and chickpeas, which are breakfast here (فول, لبلابي).

ALTER TABLE nutrition_ingredients
  ADD COLUMN IF NOT EXISTS breakfast_ok BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN nutrition_ingredients.breakfast_ok IS
  'May this food appear in Meal 1? Filters substitutions and the swap picker, so a no-eggs user does not get chicken breast at breakfast.';

UPDATE nutrition_ingredients SET breakfast_ok = FALSE WHERE id IN (
  -- dinner proteins
  'chicken_breast', 'chicken_thigh', 'turkey_breast',
  'tuna', 'sardines', 'mackerel', 'white_fish',
  -- lunch/dinner starches
  'white_rice', 'potatoes', 'sweet_potato', 'pasta', 'couscous', 'bulgur', 'barley',
  -- cooked sides and stewed legumes
  'cooked_vegetables', 'lentils', 'red_lentils', 'white_beans', 'split_peas'
);

-- ===========================================================================
-- C. Retire post-workout in plans already generated
-- ===========================================================================
-- New plans skip it at generation time (see meal-template-fill.ts). Existing
-- plans are never regenerated, so their food is moved here instead: items go
-- to the same plan's Meal 3, then the empty meal row is dropped.

UPDATE meal_plan_items i
SET meal_id = m3.id
FROM meal_plan_meals pw
JOIN meal_plan_meals m3
  ON m3.meal_plan_id = pw.meal_plan_id
 AND m3.meal_type = 'meal_3'
WHERE i.meal_id = pw.id
  AND pw.meal_type = 'post_workout';

-- Only ever deletes rows that are empty by now: any plan whose post-workout
-- meal could not be moved (no Meal 3) keeps it rather than losing the food.
DELETE FROM meal_plan_meals pw
WHERE pw.meal_type = 'post_workout'
  AND NOT EXISTS (SELECT 1 FROM meal_plan_items i WHERE i.meal_id = pw.id);
