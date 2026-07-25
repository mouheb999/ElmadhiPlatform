-- 028_nutrition_templates.sql
-- Retire the generative food-DB meal-plan builder and serve pre-built meal
-- templates, gram-scaled to the user's macro target.
--
-- This is the nutrition analog of 027_fixed_splits: the greedy picker
-- (meal-plan-gen.ts filling meals from the large `foods` catalog) is replaced
-- by 8 fixed daily templates taken verbatim from the elmadhi nutrition sheet.
-- Program generation is now "score the 8 templates on the questionnaire, copy
-- the winning one, substitute within each food slot for restrictions/dislikes,
-- then scale grams so the day hits the calorie + macro target".
--
-- Template ingredients resolve to a NEW curated canonical table
-- (nutrition_ingredients) — the whole large `foods` catalog + admin panel is
-- dropped. Every ingredient a template names (plus its substitution options)
-- lives in the seed below with standard reference per-100g macros.
--
-- The questionnaire grows to the professional 20-question spec: diet_profiles
-- gains the new answer columns. Meal plans/logs/favorites are repointed from
-- foods(UUID) to nutrition_ingredients(TEXT slug); logged history keeps its
-- denormalized macros so past days survive the drop.
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. Canonical ingredient catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS nutrition_ingredients (
  id                TEXT PRIMARY KEY,               -- slug, e.g. 'chicken_breast'
  name_en           TEXT NOT NULL,
  name_ar           TEXT NOT NULL,
  slot              TEXT NOT NULL CHECK (slot IN
                      ('protein','carb','vegetable','fat','fruit','legume','beverage')),
  calories_per_100g NUMERIC(6,1) NOT NULL,
  protein_per_100g  NUMERIC(5,1) NOT NULL,
  carbs_per_100g    NUMERIC(5,1) NOT NULL,
  fat_per_100g      NUMERIC(5,1) NOT NULL,
  fiber_per_100g    NUMERIC(5,1) NOT NULL DEFAULT 0,
  typical_serving_g NUMERIC(6,1),
  budget_tier       TEXT NOT NULL DEFAULT 'low' CHECK (budget_tier IN ('low','medium','high')),
  tags              TEXT[] NOT NULL DEFAULT '{}',
  is_slot_default   BOOLEAN NOT NULL DEFAULT FALSE,
  image_url         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_ingredients_slot ON nutrition_ingredients(slot);

ALTER TABLE nutrition_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrition_ingredients_read ON nutrition_ingredients;
CREATE POLICY nutrition_ingredients_read ON nutrition_ingredients FOR SELECT USING (TRUE);

-- ============================================================
-- 2. Meal templates + their fixed slots
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_templates (
  id            TEXT PRIMARY KEY,                    -- code, e.g. 'basic_performance'
  title_en      TEXT NOT NULL,
  title_ar      TEXT NOT NULL,
  cooking_tier  TEXT NOT NULL DEFAULT 'normal' CHECK (cooking_tier IN ('fast','normal','mealprep')),
  budget_tier   TEXT NOT NULL DEFAULT 'low' CHECK (budget_tier IN ('low','medium','high')),
  notes_en      TEXT,
  notes_ar      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_template_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   TEXT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  meal_key      TEXT NOT NULL CHECK (meal_key IN
                  ('meal_1','snack','meal_2','meal_3','pre_workout','post_workout','last_meal')),
  order_index   INT  NOT NULL,
  ingredient_id TEXT NOT NULL REFERENCES nutrition_ingredients(id),
  role          TEXT NOT NULL CHECK (role IN
                  ('protein','carb','vegetable','fat','fruit','legume','caffeine')),
  is_optional   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (template_id, meal_key, order_index)
);

CREATE INDEX IF NOT EXISTS idx_meal_template_slots_template ON meal_template_slots(template_id);

ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meal_templates_read ON meal_templates;
CREATE POLICY meal_templates_read ON meal_templates FOR SELECT USING (TRUE);

ALTER TABLE meal_template_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meal_template_slots_read ON meal_template_slots;
CREATE POLICY meal_template_slots_read ON meal_template_slots FOR SELECT USING (TRUE);

-- ============================================================
-- 3. Seed ingredients (standard reference per-100g values)
--    Meat/fish carry NO 'vegetarian' tag; fish carry 'fish'; dairy-derived
--    carry 'dairy'. These tags drive slot substitution for restrictions.
-- ============================================================
INSERT INTO nutrition_ingredients
  (id, name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, typical_serving_g, budget_tier, tags, is_slot_default) VALUES
  -- Proteins
  ('eggs',           'Eggs',            'بيض',           'protein', 143, 13.0,  1.1, 10.0, 0,   100, 'low',    ARRAY['egg','vegetarian','fast'], TRUE),
  ('chicken_breast', 'Chicken breast',  'صدر دجاج',      'protein', 165, 31.0,  0.0,  3.6, 0,   180, 'medium', ARRAY['poultry'], TRUE),
  ('chicken_thigh',  'Chicken thigh',   'فخذ دجاج',      'protein', 209, 26.0,  0.0, 10.9, 0,   180, 'low',    ARRAY['poultry'], FALSE),
  ('turkey_breast',  'Turkey breast',   'صدر ديك رومي',  'protein', 135, 29.0,  0.0,  1.0, 0,   180, 'medium', ARRAY['poultry'], FALSE),
  ('tuna',           'Tuna',            'تن',            'protein', 116, 26.0,  0.0,  1.0, 0,   120, 'low',    ARRAY['fish','fast'], FALSE),
  ('sardines',       'Sardines',        'سردينة',        'protein', 208, 25.0,  0.0, 11.0, 0,   120, 'low',    ARRAY['fish'], FALSE),
  ('mackerel',       'Mackerel',        'ماكريل',        'protein', 205, 19.0,  0.0, 13.9, 0,   150, 'medium', ARRAY['fish'], FALSE),
  ('white_fish',     'Sea fish',        'حوت',           'protein', 100, 21.0,  0.0,  1.5, 0,   180, 'medium', ARRAY['fish'], FALSE),
  ('whey_protein',   'Whey protein',    'واي بروتين',    'protein', 375, 78.0,  8.0,  5.0, 0,    30, 'high',   ARRAY['dairy','vegetarian','whey'], FALSE),
  ('protein_bar',    'Protein bar',     'بروتين بار',    'protein', 350, 30.0, 30.0, 12.0, 3,    60, 'high',   ARRAY['dairy'], FALSE),
  -- Carbs
  ('oats',           'Oats',            'شوفان',         'carb',    379, 13.0, 67.0,  6.5, 10,   60, 'low',    ARRAY['vegetarian','high_fiber','fast'], TRUE),
  ('white_rice',     'White rice',      'روز',           'carb',    130,  2.7, 28.0,  0.3, 0.4, 150, 'low',    ARRAY['vegetarian','fast'], FALSE),
  ('potatoes',       'Potatoes',        'بطاطا',         'carb',     87,  1.9, 20.0,  0.1, 1.8, 200, 'low',    ARRAY['vegetarian','fast'], FALSE),
  ('sweet_potato',   'Sweet potato',    'بطاطا حلوة',    'carb',     90,  2.0, 21.0,  0.1, 3.0, 200, 'low',    ARRAY['vegetarian'], FALSE),
  ('whole_wheat_bread','Whole wheat bread','خبز كامل',   'carb',    247, 13.0, 41.0,  3.4, 7.0,  80, 'low',    ARRAY['vegetarian'], FALSE),
  ('pasta',          'Pasta',           'مقرونة',        'carb',    158,  6.0, 31.0,  0.9, 1.8, 150, 'low',    ARRAY['vegetarian'], FALSE),
  ('couscous',       'Couscous',        'كسكسي',         'carb',    112,  3.8, 23.0,  0.2, 1.4, 150, 'low',    ARRAY['vegetarian'], FALSE),
  ('bulgur',         'Bulgur',          'برغل',          'carb',     83,  3.0, 19.0,  0.2, 4.5, 150, 'low',    ARRAY['vegetarian','high_fiber'], FALSE),
  ('barley',         'Barley',          'شعير',          'carb',    123,  2.3, 28.0,  0.4, 3.8, 150, 'low',    ARRAY['vegetarian','high_fiber'], FALSE),
  ('semolina',       'Semolina',        'سميد',          'carb',    120,  4.0, 25.0,  0.2, 1.5, 150, 'low',    ARRAY['vegetarian'], FALSE),
  -- Vegetables
  ('mixed_salad',    'Salad',           'سلاطة',         'vegetable', 20, 1.2,  3.6, 0.2, 1.5, 200, 'low',    ARRAY['vegetarian','fast'], TRUE),
  ('cooked_vegetables','Cooked vegetables','خضرة مطيّبة','vegetable', 45, 2.5,  8.0, 0.4, 3.0, 200, 'low',    ARRAY['vegetarian'], FALSE),
  ('parsley',        'Parsley',         'معدنوس',        'vegetable', 36, 3.0,  6.0, 0.8, 3.3,  20, 'low',    ARRAY['vegetarian'], FALSE),
  -- Fats
  ('olive_oil',      'Olive oil',       'زيت زيتون',     'fat',     884,  0.0,  0.0,100.0, 0,   10, 'medium', ARRAY['vegetarian'], TRUE),
  ('peanuts',        'Peanuts',         'كاكاويّة',      'fat',     567, 26.0, 16.0, 49.0, 8.5,  30, 'low',    ARRAY['vegetarian'], FALSE),
  ('almonds',        'Almonds',         'لوز',           'fat',     579, 21.0, 22.0, 50.0, 12.5, 30, 'medium', ARRAY['vegetarian'], FALSE),
  ('olives',         'Olives',          'زيتون',         'fat',     145,  1.0,  4.0, 15.0, 3.3,  40, 'low',    ARRAY['vegetarian'], FALSE),
  ('mixed_nuts',     'Mixed nuts',      'فواكه جافة',    'fat',     607, 20.0, 21.0, 54.0, 7.0,  30, 'medium', ARRAY['vegetarian'], FALSE),
  -- Fruits
  ('banana',         'Banana',          'موز',           'fruit',    89,  1.1, 23.0, 0.3, 2.6, 120, 'low',    ARRAY['vegetarian','fast'], TRUE),
  ('apple',          'Apple',           'تفاح',          'fruit',    52,  0.3, 14.0, 0.2, 2.4, 150, 'low',    ARRAY['vegetarian','fast'], FALSE),
  ('dates',          'Dates',           'تمر',           'fruit',   282,  2.5, 75.0, 0.4, 8.0,  40, 'low',    ARRAY['vegetarian','fast'], FALSE),
  ('watermelon',     'Watermelon',      'دلاّع',         'fruit',    30,  0.6,  8.0, 0.2, 0.4, 300, 'low',    ARRAY['vegetarian','fast'], FALSE),
  -- Legumes
  ('lentils',        'Lentils',         'عدس',           'legume',  116,  9.0, 20.0, 0.4, 8.0, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], TRUE),
  ('red_lentils',    'Red lentils',     'عدس أحمر',      'legume',  100,  7.6, 17.0, 0.4, 7.0, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], FALSE),
  ('chickpeas',      'Chickpeas',       'حمّص',          'legume',  164,  9.0, 27.0, 2.6, 7.6, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], FALSE),
  ('white_beans',    'White beans',     'لوبيا بيضاء',   'legume',  139,  9.7, 25.0, 0.5, 6.3, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], FALSE),
  ('split_peas',     'Split peas',      'جلبانة يابسة',  'legume',  118,  8.3, 21.0, 0.4, 8.3, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], FALSE),
  ('fava_beans',     'Fava beans',      'فول',           'legume',  110,  7.6, 20.0, 0.4, 5.4, 200, 'low',    ARRAY['vegetarian','legume','high_fiber'], FALSE),
  -- Beverages
  ('coffee',         'Coffee',          'قهوة',          'beverage',   2, 0.1,  0.0, 0.0, 0,   200, 'low',    ARRAY['vegetarian','caffeine','fast'], TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Seed the 8 meal templates
-- ============================================================
INSERT INTO meal_templates (id, title_en, title_ar, cooking_tier, budget_tier) VALUES
  ('basic_performance',    'Basic Performance Day',      'يوم أداء أساسي',        'fast',   'low'),
  ('chicken_potato_fish',  'Chicken Potato Fish Day',    'يوم دجاج بطاطا حوت',    'normal', 'low'),
  ('budget_sardine_couscous','Budget Sardine Couscous Day','يوم سردينة كسكسي',    'normal', 'low'),
  ('turkey_pasta_recovery','Turkey Pasta Recovery Day',  'يوم ديك رومي مقرونة',   'normal', 'medium'),
  ('bulgur_chicken_tuna',  'Bulgur Chicken Tuna Day',    'يوم برغل دجاج تن',      'normal', 'low'),
  ('barley_turkey_sardine','Barley Turkey Sardine Day',  'يوم شعير ديك رومي سردينة','normal','medium'),
  ('lean_fish_sweet_potato','Lean Fish Sweet Potato Day','يوم حوت وبطاطا حلوة',   'normal', 'medium'),
  ('simple_strength',      'Simple Strength Day',        'يوم قوة بسيط',          'fast',   'low')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Seed template slots (verbatim from the 8-template sheet).
--    role 'caffeine' = coffee; whey/protein bar are is_optional.
-- ============================================================
INSERT INTO meal_template_slots (template_id, meal_key, order_index, ingredient_id, role, is_optional) VALUES
  -- TEMPLATE 01 — basic_performance
  ('basic_performance','meal_1',1,'eggs','protein',FALSE),
  ('basic_performance','meal_1',2,'oats','carb',FALSE),
  ('basic_performance','meal_1',3,'parsley','vegetable',FALSE),
  ('basic_performance','meal_1',4,'peanuts','fat',FALSE),
  ('basic_performance','meal_1',5,'coffee','caffeine',FALSE),
  ('basic_performance','snack',1,'apple','fruit',FALSE),
  ('basic_performance','snack',2,'peanuts','fat',FALSE),
  ('basic_performance','meal_2',1,'chicken_breast','protein',FALSE),
  ('basic_performance','meal_2',2,'white_rice','carb',FALSE),
  ('basic_performance','meal_2',3,'mixed_salad','vegetable',FALSE),
  ('basic_performance','meal_2',4,'olive_oil','fat',FALSE),
  ('basic_performance','meal_3',1,'tuna','protein',FALSE),
  ('basic_performance','meal_3',2,'potatoes','carb',FALSE),
  ('basic_performance','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('basic_performance','meal_3',4,'olive_oil','fat',FALSE),
  ('basic_performance','pre_workout',1,'coffee','caffeine',FALSE),
  ('basic_performance','pre_workout',2,'banana','fruit',FALSE),
  ('basic_performance','post_workout',1,'whey_protein','protein',TRUE),
  ('basic_performance','post_workout',2,'dates','fruit',FALSE),
  ('basic_performance','last_meal',1,'lentils','legume',FALSE),
  ('basic_performance','last_meal',2,'eggs','protein',FALSE),
  ('basic_performance','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 02 — chicken_potato_fish
  ('chicken_potato_fish','meal_1',1,'eggs','protein',FALSE),
  ('chicken_potato_fish','meal_1',2,'whole_wheat_bread','carb',FALSE),
  ('chicken_potato_fish','meal_1',3,'olives','fat',FALSE),
  ('chicken_potato_fish','meal_1',4,'coffee','caffeine',FALSE),
  ('chicken_potato_fish','snack',1,'banana','fruit',FALSE),
  ('chicken_potato_fish','snack',2,'peanuts','fat',FALSE),
  ('chicken_potato_fish','meal_2',1,'chicken_breast','protein',FALSE),
  ('chicken_potato_fish','meal_2',2,'potatoes','carb',FALSE),
  ('chicken_potato_fish','meal_2',3,'mixed_salad','vegetable',FALSE),
  ('chicken_potato_fish','meal_2',4,'olive_oil','fat',FALSE),
  ('chicken_potato_fish','meal_3',1,'white_fish','protein',FALSE),
  ('chicken_potato_fish','meal_3',2,'white_rice','carb',FALSE),
  ('chicken_potato_fish','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('chicken_potato_fish','meal_3',4,'olive_oil','fat',FALSE),
  ('chicken_potato_fish','pre_workout',1,'coffee','caffeine',FALSE),
  ('chicken_potato_fish','pre_workout',2,'dates','fruit',FALSE),
  ('chicken_potato_fish','post_workout',1,'whey_protein','protein',TRUE),
  ('chicken_potato_fish','post_workout',2,'banana','fruit',FALSE),
  ('chicken_potato_fish','last_meal',1,'couscous','carb',FALSE),
  ('chicken_potato_fish','last_meal',2,'tuna','protein',FALSE),
  ('chicken_potato_fish','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 03 — budget_sardine_couscous
  ('budget_sardine_couscous','meal_1',1,'eggs','protein',FALSE),
  ('budget_sardine_couscous','meal_1',2,'oats','carb',FALSE),
  ('budget_sardine_couscous','meal_1',3,'peanuts','fat',FALSE),
  ('budget_sardine_couscous','meal_1',4,'coffee','caffeine',FALSE),
  ('budget_sardine_couscous','snack',1,'apple','fruit',FALSE),
  ('budget_sardine_couscous','snack',2,'peanuts','fat',FALSE),
  ('budget_sardine_couscous','meal_2',1,'chicken_thigh','protein',FALSE),
  ('budget_sardine_couscous','meal_2',2,'couscous','carb',FALSE),
  ('budget_sardine_couscous','meal_2',3,'cooked_vegetables','vegetable',FALSE),
  ('budget_sardine_couscous','meal_2',4,'olive_oil','fat',FALSE),
  ('budget_sardine_couscous','meal_3',1,'sardines','protein',FALSE),
  ('budget_sardine_couscous','meal_3',2,'potatoes','carb',FALSE),
  ('budget_sardine_couscous','meal_3',3,'mixed_salad','vegetable',FALSE),
  ('budget_sardine_couscous','meal_3',4,'olive_oil','fat',FALSE),
  ('budget_sardine_couscous','pre_workout',1,'coffee','caffeine',FALSE),
  ('budget_sardine_couscous','pre_workout',2,'watermelon','fruit',FALSE),
  ('budget_sardine_couscous','post_workout',1,'whey_protein','protein',TRUE),
  ('budget_sardine_couscous','post_workout',2,'dates','fruit',FALSE),
  ('budget_sardine_couscous','last_meal',1,'red_lentils','legume',FALSE),
  ('budget_sardine_couscous','last_meal',2,'eggs','protein',FALSE),
  ('budget_sardine_couscous','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 04 — turkey_pasta_recovery
  ('turkey_pasta_recovery','meal_1',1,'eggs','protein',FALSE),
  ('turkey_pasta_recovery','meal_1',2,'whole_wheat_bread','carb',FALSE),
  ('turkey_pasta_recovery','meal_1',3,'peanuts','fat',FALSE),
  ('turkey_pasta_recovery','meal_1',4,'coffee','caffeine',FALSE),
  ('turkey_pasta_recovery','snack',1,'banana','fruit',FALSE),
  ('turkey_pasta_recovery','snack',2,'protein_bar','protein',TRUE),
  ('turkey_pasta_recovery','meal_2',1,'turkey_breast','protein',FALSE),
  ('turkey_pasta_recovery','meal_2',2,'pasta','carb',FALSE),
  ('turkey_pasta_recovery','meal_2',3,'mixed_salad','vegetable',FALSE),
  ('turkey_pasta_recovery','meal_2',4,'olive_oil','fat',FALSE),
  ('turkey_pasta_recovery','meal_3',1,'mackerel','protein',FALSE),
  ('turkey_pasta_recovery','meal_3',2,'potatoes','carb',FALSE),
  ('turkey_pasta_recovery','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('turkey_pasta_recovery','meal_3',4,'olive_oil','fat',FALSE),
  ('turkey_pasta_recovery','pre_workout',1,'coffee','caffeine',FALSE),
  ('turkey_pasta_recovery','pre_workout',2,'apple','fruit',FALSE),
  ('turkey_pasta_recovery','post_workout',1,'whey_protein','protein',TRUE),
  ('turkey_pasta_recovery','post_workout',2,'banana','fruit',FALSE),
  ('turkey_pasta_recovery','last_meal',1,'white_rice','carb',FALSE),
  ('turkey_pasta_recovery','last_meal',2,'tuna','protein',FALSE),
  ('turkey_pasta_recovery','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 05 — bulgur_chicken_tuna
  ('bulgur_chicken_tuna','meal_1',1,'eggs','protein',FALSE),
  ('bulgur_chicken_tuna','meal_1',2,'oats','carb',FALSE),
  ('bulgur_chicken_tuna','meal_1',3,'peanuts','fat',FALSE),
  ('bulgur_chicken_tuna','meal_1',4,'coffee','caffeine',FALSE),
  ('bulgur_chicken_tuna','snack',1,'apple','fruit',FALSE),
  ('bulgur_chicken_tuna','snack',2,'peanuts','fat',FALSE),
  ('bulgur_chicken_tuna','meal_2',1,'chicken_breast','protein',FALSE),
  ('bulgur_chicken_tuna','meal_2',2,'bulgur','carb',FALSE),
  ('bulgur_chicken_tuna','meal_2',3,'cooked_vegetables','vegetable',FALSE),
  ('bulgur_chicken_tuna','meal_2',4,'olive_oil','fat',FALSE),
  ('bulgur_chicken_tuna','meal_3',1,'tuna','protein',FALSE),
  ('bulgur_chicken_tuna','meal_3',2,'white_rice','carb',FALSE),
  ('bulgur_chicken_tuna','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('bulgur_chicken_tuna','meal_3',4,'olive_oil','fat',FALSE),
  ('bulgur_chicken_tuna','pre_workout',1,'coffee','caffeine',FALSE),
  ('bulgur_chicken_tuna','pre_workout',2,'dates','fruit',FALSE),
  ('bulgur_chicken_tuna','post_workout',1,'whey_protein','protein',TRUE),
  ('bulgur_chicken_tuna','post_workout',2,'watermelon','fruit',FALSE),
  ('bulgur_chicken_tuna','last_meal',1,'chickpeas','legume',FALSE),
  ('bulgur_chicken_tuna','last_meal',2,'eggs','protein',FALSE),
  ('bulgur_chicken_tuna','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 06 — barley_turkey_sardine
  ('barley_turkey_sardine','meal_1',1,'eggs','protein',FALSE),
  ('barley_turkey_sardine','meal_1',2,'oats','carb',FALSE),
  ('barley_turkey_sardine','meal_1',3,'peanuts','fat',FALSE),
  ('barley_turkey_sardine','meal_1',4,'coffee','caffeine',FALSE),
  ('barley_turkey_sardine','snack',1,'banana','fruit',FALSE),
  ('barley_turkey_sardine','snack',2,'mixed_nuts','fat',FALSE),
  ('barley_turkey_sardine','meal_2',1,'turkey_breast','protein',FALSE),
  ('barley_turkey_sardine','meal_2',2,'white_rice','carb',FALSE),
  ('barley_turkey_sardine','meal_2',3,'mixed_salad','vegetable',FALSE),
  ('barley_turkey_sardine','meal_2',4,'olive_oil','fat',FALSE),
  ('barley_turkey_sardine','meal_3',1,'sardines','protein',FALSE),
  ('barley_turkey_sardine','meal_3',2,'barley','carb',FALSE),
  ('barley_turkey_sardine','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('barley_turkey_sardine','meal_3',4,'olive_oil','fat',FALSE),
  ('barley_turkey_sardine','pre_workout',1,'coffee','caffeine',FALSE),
  ('barley_turkey_sardine','pre_workout',2,'apple','fruit',FALSE),
  ('barley_turkey_sardine','post_workout',1,'whey_protein','protein',TRUE),
  ('barley_turkey_sardine','post_workout',2,'dates','fruit',FALSE),
  ('barley_turkey_sardine','last_meal',1,'white_beans','legume',FALSE),
  ('barley_turkey_sardine','last_meal',2,'tuna','protein',FALSE),
  ('barley_turkey_sardine','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 07 — lean_fish_sweet_potato
  ('lean_fish_sweet_potato','meal_1',1,'eggs','protein',FALSE),
  ('lean_fish_sweet_potato','meal_1',2,'oats','carb',FALSE),
  ('lean_fish_sweet_potato','meal_1',3,'peanuts','fat',FALSE),
  ('lean_fish_sweet_potato','meal_1',4,'coffee','caffeine',FALSE),
  ('lean_fish_sweet_potato','snack',1,'apple','fruit',FALSE),
  ('lean_fish_sweet_potato','snack',2,'peanuts','fat',FALSE),
  ('lean_fish_sweet_potato','meal_2',1,'chicken_breast','protein',FALSE),
  ('lean_fish_sweet_potato','meal_2',2,'sweet_potato','carb',FALSE),
  ('lean_fish_sweet_potato','meal_2',3,'mixed_salad','vegetable',FALSE),
  ('lean_fish_sweet_potato','meal_2',4,'olive_oil','fat',FALSE),
  ('lean_fish_sweet_potato','meal_3',1,'white_fish','protein',FALSE),
  ('lean_fish_sweet_potato','meal_3',2,'couscous','carb',FALSE),
  ('lean_fish_sweet_potato','meal_3',3,'cooked_vegetables','vegetable',FALSE),
  ('lean_fish_sweet_potato','meal_3',4,'olive_oil','fat',FALSE),
  ('lean_fish_sweet_potato','pre_workout',1,'coffee','caffeine',FALSE),
  ('lean_fish_sweet_potato','pre_workout',2,'banana','fruit',FALSE),
  ('lean_fish_sweet_potato','post_workout',1,'whey_protein','protein',TRUE),
  ('lean_fish_sweet_potato','post_workout',2,'dates','fruit',FALSE),
  ('lean_fish_sweet_potato','last_meal',1,'split_peas','legume',FALSE),
  ('lean_fish_sweet_potato','last_meal',2,'eggs','protein',FALSE),
  ('lean_fish_sweet_potato','last_meal',3,'cooked_vegetables','vegetable',FALSE),
  -- TEMPLATE 08 — simple_strength
  ('simple_strength','meal_1',1,'eggs','protein',FALSE),
  ('simple_strength','meal_1',2,'whole_wheat_bread','carb',FALSE),
  ('simple_strength','meal_1',3,'olives','fat',FALSE),
  ('simple_strength','meal_1',4,'coffee','caffeine',FALSE),
  ('simple_strength','snack',1,'watermelon','fruit',FALSE),
  ('simple_strength','snack',2,'peanuts','fat',FALSE),
  ('simple_strength','meal_2',1,'chicken_breast','protein',FALSE),
  ('simple_strength','meal_2',2,'pasta','carb',FALSE),
  ('simple_strength','meal_2',3,'cooked_vegetables','vegetable',FALSE),
  ('simple_strength','meal_2',4,'olive_oil','fat',FALSE),
  ('simple_strength','meal_3',1,'tuna','protein',FALSE),
  ('simple_strength','meal_3',2,'potatoes','carb',FALSE),
  ('simple_strength','meal_3',3,'mixed_salad','vegetable',FALSE),
  ('simple_strength','meal_3',4,'olive_oil','fat',FALSE),
  ('simple_strength','pre_workout',1,'coffee','caffeine',FALSE),
  ('simple_strength','pre_workout',2,'dates','fruit',FALSE),
  ('simple_strength','post_workout',1,'whey_protein','protein',TRUE),
  ('simple_strength','post_workout',2,'banana','fruit',FALSE),
  ('simple_strength','last_meal',1,'fava_beans','legume',FALSE),
  ('simple_strength','last_meal',2,'tuna','protein',FALSE),
  ('simple_strength','last_meal',3,'cooked_vegetables','vegetable',FALSE)
ON CONFLICT (template_id, meal_key, order_index) DO NOTHING;

-- ============================================================
-- 6. Extend diet_profiles with the professional 20-Q answers
-- ============================================================
ALTER TABLE diet_profiles
  ADD COLUMN IF NOT EXISTS target_weight_kg      NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS body_fat_level        TEXT,
  ADD COLUMN IF NOT EXISTS daily_steps           TEXT,
  ADD COLUMN IF NOT EXISTS training_days         TEXT,
  ADD COLUMN IF NOT EXISTS training_time         TEXT,
  ADD COLUMN IF NOT EXISTS cooking_pref          TEXT,
  ADD COLUMN IF NOT EXISTS digestion             TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS water_intake          TEXT,
  ADD COLUMN IF NOT EXISTS supplements           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tracking_experience   TEXT,
  ADD COLUMN IF NOT EXISTS food_restrictions     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_foods           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_template_code TEXT REFERENCES meal_templates(id);

-- meals_per_day: spec only offers 3/4/5. Widen the lower bound guard.
ALTER TABLE diet_profiles DROP CONSTRAINT IF EXISTS diet_profiles_meals_per_day_check;
ALTER TABLE diet_profiles ADD CONSTRAINT diet_profiles_meals_per_day_check
  CHECK (meals_per_day BETWEEN 3 AND 5);

-- ============================================================
-- 7. Repoint meal plans from foods(UUID) to nutrition_ingredients(TEXT)
-- ============================================================
-- Stale plans reference dropped foods; clear them (users regenerate).
DELETE FROM meal_plans;

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS template_code TEXT REFERENCES meal_templates(id);

-- meal_plan_meals: allow the richer template meal_keys and a display label.
ALTER TABLE meal_plan_meals DROP CONSTRAINT IF EXISTS meal_plan_meals_meal_type_check;
ALTER TABLE meal_plan_meals ADD CONSTRAINT meal_plan_meals_meal_type_check
  CHECK (meal_type IN ('meal_1','snack','meal_2','meal_3','pre_workout','post_workout','last_meal',
                       'breakfast','lunch','dinner','snack_1','snack_2'));
ALTER TABLE meal_plan_meals ADD COLUMN IF NOT EXISTS slot_label TEXT;

-- meal_plan_items: swap the food/recipe/user_food trio for an ingredient ref.
ALTER TABLE meal_plan_items DROP CONSTRAINT IF EXISTS meal_plan_items_check;
ALTER TABLE meal_plan_items DROP COLUMN IF EXISTS food_id;
ALTER TABLE meal_plan_items DROP COLUMN IF EXISTS recipe_id;
ALTER TABLE meal_plan_items DROP COLUMN IF EXISTS user_food_id;
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS ingredient_id TEXT REFERENCES nutrition_ingredients(id);
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 8. Repoint meal_logs + food_favorites to nutrition_ingredients
-- ============================================================
-- Logged rows keep their denormalized macros; only the join key changes.
ALTER TABLE meal_logs DROP COLUMN IF EXISTS food_id;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS ingredient_id TEXT REFERENCES nutrition_ingredients(id) ON DELETE SET NULL;

-- Favorites keyed on foods(UUID); rebuild keyed on ingredients(TEXT).
DROP TABLE IF EXISTS food_favorites;
CREATE TABLE food_favorites (
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES nutrition_ingredients(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, ingredient_id)
);
ALTER TABLE food_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_food_favorites" ON food_favorites;
CREATE POLICY "own_food_favorites" ON food_favorites FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 9. Drop the large foods catalog + its dependents (CASCADE removes the
--    007 search trigger, 006 indexes, and 010 image column with the table)
-- ============================================================
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS user_foods CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP FUNCTION IF EXISTS foods_search_update() CASCADE;
DROP FUNCTION IF EXISTS recipes_search_update() CASCADE;

COMMIT;
