-- 049_food_library.sql
-- Rebuilds `nutrition_ingredients` into a library of food people actually eat.
--
-- WHY. The seed in 028 was a gym shopping list: 39 rows, no milk, no yogurt,
-- no cheese, no red meat, no tomato, no orange, one kind of bread. Two of its
-- rows were not food you plan a meal around at all --
--   parsley   a garnish, seeded into the `vegetable` slot AND wired into
--             basic_performance Meal 1, so the generator served
--             "eggs, oats, 20 g parsley, peanuts" as a breakfast;
--   semolina  raw flour. In no template, but every swap picker and diary
--             search offered it as a food to eat.
-- Both are what customers reported. Neither is deleted -- logged history and
-- live plans reference them by FK -- they are taken OUT OF THE CATALOG instead.
--
-- WHAT CHANGES
--   1. `in_catalog`    retires a food from every picker without losing history.
--   2. `main_meal_ok`  the mirror of 036's `breakfast_ok`. Adding yogurt and
--                      cheese to the protein slot without it would let the
--                      substitution step and the lean-protein guard serve
--                      "Greek yogurt + rice" as dinner. `breakfast_ok` says
--                      what may open the day; this says what may carry a main
--                      meal. A food can be neither (honey), either, or both.
--   3. `red_meat` tag  028 left the `no_red_meat` restriction unimplemented
--                      with the note "no template ingredient is red meat".
--                      That stops being true on this migration, so the tag
--                      lands here and meal-template-fill.ts filters on it.
--   4. 38 new foods    the staples the library was missing, per 100 g as the
--                      food is EATEN -- cooked for grains and legumes, raw for
--                      fruit/veg/dairy -- which is the convention 028 already
--                      used (white rice 130, not 360).
--   5. Meal 1 fix      basic_performance's parsley slot becomes tomato, the
--                      vegetable that actually goes next to eggs here.
--
-- Nothing regenerates an existing plan: meal_plans store their items as rows,
-- and only a redo re-runs the solver. Existing users keep exactly the plan
-- they have; the new library reaches them through the swap picker and their
-- next rebuild.
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. Two new flags
-- ============================================================
ALTER TABLE nutrition_ingredients
  ADD COLUMN IF NOT EXISTS in_catalog   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS main_meal_ok BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN nutrition_ingredients.in_catalog IS
  'May this food be CHOSEN? False retires it from the generator, the swap picker and the diary search while leaving every row that already references it intact. Never delete a food - plans and logs point at it.';

COMMENT ON COLUMN nutrition_ingredients.main_meal_ok IS
  'May this food carry Meal 2 / Meal 3 / the last meal? Mirror of breakfast_ok. False for foods that are real food but not a dinner: yogurt, cheese, honey, nut butter.';

-- ============================================================
-- 2. Retire the two the customers flagged
-- ============================================================
UPDATE nutrition_ingredients SET in_catalog = FALSE WHERE id IN ('parsley', 'semolina');

-- ============================================================
-- 3. The foods that were missing.
--    tags drive substitution: meat/fish carry NO 'vegetarian';
--    fish carry 'fish'; dairy carry 'dairy'; red meat carries 'red_meat'.
-- ============================================================
INSERT INTO nutrition_ingredients
  (id, name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
   fiber_per_100g, typical_serving_g, budget_tier, tags, is_slot_default, breakfast_ok, main_meal_ok) VALUES
  -- ---- Proteins: red meat, offal, seafood ----
  ('beef_mince',   'Lean minced beef', 'لحم بقري مفروم', 'protein', 176, 20.0, 0.0, 10.0, 0,   150, 'medium', ARRAY['red_meat'],             FALSE, FALSE, TRUE),
  ('beef_steak',   'Beef steak',       'لحم بقري',       'protein', 187, 27.0, 0.0,  8.5, 0,   180, 'high',   ARRAY['red_meat'],             FALSE, FALSE, TRUE),
  ('lamb',         'Lamb',             'لحم غنمي',       'protein', 258, 25.0, 0.0, 17.0, 0,   150, 'high',   ARRAY['red_meat'],             FALSE, FALSE, TRUE),
  ('liver',        'Liver',            'كبدة',           'protein', 165, 24.0, 4.0,  5.0, 0,   120, 'low',    ARRAY['red_meat','organ'],     FALSE, FALSE, TRUE),
  ('merguez',      'Merguez',          'مرقاز',          'protein', 290, 16.0, 2.0, 24.0, 0,   100, 'high',   ARRAY['red_meat','processed'], FALSE, FALSE, TRUE),
  ('shrimp',       'Shrimp',           'قمرون',          'protein',  99, 24.0, 0.2,  0.3, 0,   150, 'high',   ARRAY['fish','seafood'],       FALSE, FALSE, TRUE),
  -- ---- Proteins: dairy. Breakfast and snack food, never a dinner. ----
  ('greek_yogurt', 'Greek yogurt',       'ياغورت يوناني', 'protein',  59, 10.0, 3.6,  0.4, 0, 170, 'medium', ARRAY['dairy','vegetarian','fast'], FALSE, TRUE, FALSE),
  ('yogurt_plain', 'Plain yogurt',       'ياغورت طبيعي',  'protein',  61,  3.5, 4.7,  3.3, 0, 125, 'low',    ARRAY['dairy','vegetarian','fast'], FALSE, TRUE, FALSE),
  ('fresh_cheese', 'Fresh white cheese', 'جبن طري',       'protein',  98, 12.0, 3.5,  4.0, 0, 100, 'low',    ARRAY['dairy','vegetarian','fast'], FALSE, TRUE, FALSE),
  ('hard_cheese',  'Hard cheese',        'جبن قاسي',      'protein', 380, 25.0, 1.5, 30.0, 0,  30, 'medium', ARRAY['dairy','vegetarian','fast'], FALSE, TRUE, FALSE),
  -- ---- Carbs ----
  ('brown_rice',    'Brown rice',    'روز كامل',   'carb', 123, 2.7, 26.0, 1.0, 1.8, 150, 'low',    ARRAY['vegetarian','high_fiber'], FALSE, FALSE, TRUE),
  ('baguette',      'Baguette',      'خبز',        'carb', 270, 9.0, 52.0, 2.0, 2.5,  80, 'low',    ARRAY['vegetarian','fast'],       FALSE, TRUE,  TRUE),
  ('tabouna_bread', 'Tabouna bread', 'خبز طابونة', 'carb', 265, 8.0, 52.0, 2.5, 3.0,  80, 'low',    ARRAY['vegetarian','fast'],       FALSE, TRUE,  TRUE),
  ('quinoa',        'Quinoa',        'كينوا',      'carb', 120, 4.4, 21.0, 1.9, 2.8, 150, 'high',   ARRAY['vegetarian','high_fiber'], FALSE, FALSE, TRUE),
  ('corn',          'Sweet corn',    'ذرة',        'carb',  96, 3.4, 21.0, 1.5, 2.4, 150, 'low',    ARRAY['vegetarian'],              FALSE, FALSE, TRUE),
  ('honey',         'Honey',         'عسل',        'carb', 304, 0.3, 82.0, 0.0, 0.2,  20, 'medium', ARRAY['vegetarian','fast'],       FALSE, TRUE,  FALSE),
  -- ---- Vegetables ----
  ('tomato',      'Tomato',      'طماطم',       'vegetable', 18, 0.9,  3.9, 0.2, 1.2, 150, 'low', ARRAY['vegetarian','fast'], FALSE, TRUE,  TRUE),
  ('cucumber',    'Cucumber',    'خيار',        'vegetable', 15, 0.7,  3.6, 0.1, 0.5, 150, 'low', ARRAY['vegetarian','fast'], FALSE, TRUE,  TRUE),
  ('carrot',      'Carrot',      'سفنارية',     'vegetable', 41, 0.9, 10.0, 0.2, 2.8, 150, 'low', ARRAY['vegetarian','fast'], FALSE, TRUE,  TRUE),
  ('bell_pepper', 'Bell pepper', 'فلفل',        'vegetable', 26, 1.0,  6.0, 0.3, 2.1, 150, 'low', ARRAY['vegetarian','fast'], FALSE, TRUE,  TRUE),
  ('green_beans', 'Green beans', 'لوبيا خضراء', 'vegetable', 35, 1.8,  7.0, 0.2, 3.4, 200, 'low', ARRAY['vegetarian'],        FALSE, FALSE, TRUE),
  ('spinach',     'Spinach',     'سبناخ',       'vegetable', 23, 2.9,  3.6, 0.4, 2.2, 200, 'low', ARRAY['vegetarian'],        FALSE, FALSE, TRUE),
  ('zucchini',    'Zucchini',    'قرعة خضراء',  'vegetable', 17, 1.2,  3.1, 0.3, 1.0, 200, 'low', ARRAY['vegetarian'],        FALSE, FALSE, TRUE),
  ('onion',       'Onion',       'بصل',         'vegetable', 40, 1.1,  9.3, 0.1, 1.7, 100, 'low', ARRAY['vegetarian'],        FALSE, FALSE, TRUE),
  -- ---- Fruit ----
  ('orange',     'Orange',       'برتقال', 'fruit', 47, 0.9, 12.0, 0.1, 2.4, 150, 'low',    ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  ('strawberry', 'Strawberries', 'فراولة', 'fruit', 32, 0.7,  7.7, 0.3, 2.0, 150, 'medium', ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  ('grapes',     'Grapes',       'عنب',    'fruit', 69, 0.7, 18.0, 0.2, 0.9, 150, 'low',    ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  ('pear',       'Pear',         'إنجاص',  'fruit', 57, 0.4, 15.0, 0.1, 3.1, 170, 'low',    ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  ('peach',      'Peach',        'خوخ',    'fruit', 39, 0.9, 10.0, 0.3, 1.5, 150, 'low',    ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  ('figs',       'Figs',         'كرموس',  'fruit', 74, 0.8, 19.0, 0.3, 2.9,  50, 'low',    ARRAY['vegetarian','fast'], FALSE, TRUE, TRUE),
  -- ---- Fats ----
  ('peanut_butter',  'Peanut butter',  'زبدة الكاكاوية', 'fat', 588, 25.0, 20.0, 50.0, 6.0,  30, 'medium', ARRAY['vegetarian','fast'],         FALSE, TRUE, FALSE),
  ('tahini',         'Tahini',         'طحينة',          'fat', 595, 17.0, 21.0, 54.0, 9.3,  15, 'medium', ARRAY['vegetarian','fast'],         FALSE, TRUE, FALSE),
  ('walnuts',        'Walnuts',        'جوز',            'fat', 654, 15.0, 14.0, 65.0, 6.7,  30, 'medium', ARRAY['vegetarian'],                FALSE, TRUE, TRUE),
  ('avocado',        'Avocado',        'أفوكادو',        'fat', 160,  2.0,  9.0, 15.0, 7.0, 100, 'high',   ARRAY['vegetarian','fast'],         FALSE, TRUE, TRUE),
  ('butter',         'Butter',         'زبدة',           'fat', 717,  0.9,  0.1, 81.0, 0,    10, 'medium', ARRAY['dairy','vegetarian','fast'], FALSE, TRUE, FALSE),
  ('dark_chocolate', 'Dark chocolate', 'شوكولاطة سوداء', 'fat', 546,  5.0, 46.0, 35.0, 7.0,  25, 'medium', ARRAY['vegetarian','fast'],         FALSE, TRUE, FALSE),
  -- ---- Beverages. Milk sits here, not in `protein`: at 3.4 g per 100 g the
  --      gram-scaler would pour two litres of it to hit a protein target.
  ('milk', 'Milk', 'حليب', 'beverage', 47, 3.4, 4.8, 1.6, 0, 250, 'low', ARRAY['dairy','vegetarian','fast'],    FALSE, TRUE, TRUE),
  ('tea',  'Tea',  'تاي',  'beverage',  1, 0.0, 0.3, 0.0, 0, 200, 'low', ARRAY['vegetarian','caffeine','fast'], FALSE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Household units for the new foods that are not weighed
--    (same rule as 036: counted, spooned, poured or bought by the pack)
-- ============================================================
WITH units(id, unit_en, unit_en_plural, unit_ar, unit_ar_plural, grams) AS (VALUES
  -- counted whole
  ('orange',        'orange', 'oranges', 'برتقالة', 'برتقالات', 150),
  ('pear',          'pear',   'pears',   'إنجاصة',  'إنجاص',    170),
  ('peach',         'peach',  'peaches', 'خوخة',    'خوخات',    150),
  ('figs',          'fig',    'figs',    'كرموسة',  'كرموس',     50),
  ('avocado',       'half',   'halves',  'نصف',     'أنصاف',    100),
  -- sliced
  ('baguette',      'slice',  'slices',  'شريحة',   'شرايح',     30),
  ('tabouna_bread', 'piece',  'pieces',  'قطعة',    'قطع',       80),
  -- spooned and poured
  ('honey',         'tbsp',   'tbsp',    'ملعقة كبيرة', 'ملاعق كبيرة', 20),
  ('peanut_butter', 'tbsp',   'tbsp',    'ملعقة كبيرة', 'ملاعق كبيرة', 15),
  ('tahini',        'tbsp',   'tbsp',    'ملعقة كبيرة', 'ملاعق كبيرة', 15),
  ('butter',        'tbsp',   'tbsp',    'ملعقة كبيرة', 'ملاعق كبيرة', 10),
  ('milk',          'cup',    'cups',    'كأس',     'كيسان',    250),
  ('tea',           'cup',    'cups',    'فنجان',   'فناجن',    200),
  -- by the pot
  ('yogurt_plain',  'pot',    'pots',    'علبة',    'علب',      125),
  ('greek_yogurt',  'pot',    'pots',    'علبة',    'علب',      170),
  -- by the handful / the square
  ('walnuts',        'handful', 'handfuls', 'حفنة',  'حفنات',    30),
  ('dark_chocolate', 'square',  'squares',  'مربع',  'مربعات',   10)
)
UPDATE nutrition_ingredients n
SET unit_en        = u.unit_en,
    unit_en_plural = u.unit_en_plural,
    unit_ar        = u.unit_ar,
    unit_ar_plural = u.unit_ar_plural,
    unit_grams     = u.grams
FROM units u
WHERE n.id = u.id;

-- ============================================================
-- 5. Foods already in the library that are not a main meal either
-- ============================================================
UPDATE nutrition_ingredients SET main_meal_ok = FALSE
WHERE id IN ('whey_protein', 'protein_bar', 'coffee', 'dates', 'watermelon');

-- ============================================================
-- 6. Meal 1 of basic_performance: parsley -> tomato.
--    The slot is a `vegetable` next to eggs. Tomato is what that is.
-- ============================================================
UPDATE meal_template_slots
SET ingredient_id = 'tomato'
WHERE template_id = 'basic_performance'
  AND meal_key = 'meal_1'
  AND ingredient_id = 'parsley';

COMMIT;
