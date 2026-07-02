-- 003_diet_tables.sql
-- Diet Maker domain tables. Indexes live in 006, search triggers in 007.

-- Answers to the diet questions, versioned per generation.
CREATE TABLE diet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),

  goal TEXT CHECK (goal IN ('lose_fat', 'maintain', 'build_muscle', 'recomp')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),

  meals_per_day INTEGER DEFAULT 3 CHECK (meals_per_day BETWEEN 2 AND 6),
  budget_level TEXT CHECK (budget_level IN ('low', 'medium', 'high')),
  allergies TEXT[],
  dietary_restriction TEXT,
  disliked_foods UUID[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed macro targets (one per active diet_profile).
CREATE TABLE macro_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_profile_id UUID NOT NULL REFERENCES diet_profiles(id) ON DELETE CASCADE,
  bmr INTEGER NOT NULL,
  tdee INTEGER NOT NULL,
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  fiber_g INTEGER NOT NULL,
  rationale_json JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food database (Tunisian-focused).
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  category TEXT NOT NULL,
  calories_per_100g NUMERIC(6,1) NOT NULL,
  protein_per_100g NUMERIC(5,1) NOT NULL,
  carbs_per_100g NUMERIC(5,1) NOT NULL,
  fat_per_100g NUMERIC(5,1) NOT NULL,
  fiber_per_100g NUMERIC(5,1) DEFAULT 0,
  typical_serving_g NUMERIC(6,1),
  price_tnd_per_kg NUMERIC(6,2),
  price_tier TEXT CHECK (price_tier IN ('low', 'medium', 'high')),
  allergens TEXT[],
  tags TEXT[],
  is_common BOOLEAN DEFAULT FALSE,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite dishes (couscous, lablabi, ojja, ...).
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  category TEXT,
  typical_serving_g NUMERIC(6,1),
  calories_per_100g NUMERIC(6,1),
  protein_per_100g NUMERIC(5,1),
  carbs_per_100g NUMERIC(5,1),
  fat_per_100g NUMERIC(5,1),
  fiber_per_100g NUMERIC(5,1),
  price_tier TEXT,
  allergens TEXT[],
  tags TEXT[],
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id),
  quantity_g NUMERIC(6,1) NOT NULL,
  order_index INTEGER
);

-- User custom foods.
CREATE TABLE user_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories_per_100g NUMERIC(6,1) NOT NULL,
  protein_per_100g NUMERIC(5,1) NOT NULL,
  carbs_per_100g NUMERIC(5,1) NOT NULL,
  fat_per_100g NUMERIC(5,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated meal plan (one active per user, history kept via version).
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  diet_profile_id UUID NOT NULL REFERENCES diet_profiles(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  user_modified BOOLEAN DEFAULT FALSE,
  warnings_acknowledged JSONB
);

-- A meal plan contains meals (one row per meal slot per day).
CREATE TABLE meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack_1', 'snack_2')),
  order_index INTEGER NOT NULL
);

-- Items inside each meal (a food, recipe, or user food, with quantity).
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meal_plan_meals(id) ON DELETE CASCADE,
  food_id UUID REFERENCES foods(id),
  recipe_id UUID REFERENCES recipes(id),
  user_food_id UUID REFERENCES user_foods(id),
  quantity_g NUMERIC(6,1) NOT NULL,
  is_user_modified BOOLEAN DEFAULT FALSE,
  CHECK (
    (food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int + (user_food_id IS NOT NULL)::int = 1
  )
);
