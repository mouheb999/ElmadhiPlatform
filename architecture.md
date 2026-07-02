# Self-Coaching Platform — Architecture Blueprint v2

## Stack

Next.js 14+ (App Router) · Supabase (Postgres + Auth + Storage) · Vercel · TypeScript · Tailwind CSS · React Query · shadcn/ui

---

## 1. Product Philosophy

The platform replaces a personal coach. Three pillars, each self-contained:

1. **Diet Maker** — asks the user simple questions, computes macros, explains the reasoning, delivers an editable meal plan.
2. **Workout Maker** — asks training questions, matches a program, explains the reasoning, delivers an editable program.
3. **Q&A Library** — TikTok-style swipeable curated content answering the most common fitness/nutrition questions.

Core UX rules:
- Questions are written for a complete beginner. Never use jargon like "bulk", "cut", "TDEE", "hypertrophy", "macros". Translate everything into everyday language.
- Each Maker section follows the same flow: **Questions → Rationale → Editable Plan**.
- Plans are generated once and persist. Each section has a "Redo my goals" button that re-asks the questions and creates a new version (old versions archived, not deleted).
- Edits are allowed everywhere. If the user breaks the logic (removes too much protein, skips a muscle group), the app shows a warning but lets them save.

---

## 2. Rendering Strategy

**Static (SSG / ISR)** — built at deploy, served from CDN:
- Landing page
- Pricing page
- Q&A library shell (content cards are static, fetched once and cached)

**Server Components (RSC)** — server-rendered per request:
- Dashboard (reads user's active plans)
- Diet Maker landing (reads current plan if exists, else shows "Start" CTA)
- Workout Maker landing (same pattern)
- Settings

**Client Components** — interactive only:
- Question wizards (step-by-step forms with state)
- Meal plan editor (live macro recalculation)
- Workout program editor (exercise swap, set/rep edit)
- Q&A swipeable feed
- Progress charts

Rule: if no `useState`, `useEffect`, or event handlers → server component.

---

## 3. Database Schema

### Identity & access

```sql
-- Profile: identity only
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  has_paid BOOLEAN DEFAULT FALSE,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  plan_expires_at TIMESTAMPTZ,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Diet Maker tables

```sql
-- Stores the answers to diet questions, per generation
CREATE TABLE diet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  -- Identity & body (asked simply)
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),

  -- Goal (asked as "What do you want?")
  goal TEXT CHECK (goal IN ('lose_fat', 'maintain', 'build_muscle', 'recomp')),

  -- Activity (asked as "How active is your day?")
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),

  -- Diet preferences
  meals_per_day INTEGER DEFAULT 3 CHECK (meals_per_day BETWEEN 2 AND 6),
  budget_level TEXT CHECK (budget_level IN ('low', 'medium', 'high')),
  allergies TEXT[],              -- ['lactose', 'gluten', 'nuts', 'shellfish', 'eggs']
  dietary_restriction TEXT,      -- 'none', 'vegetarian', 'pescatarian', 'halal'
  disliked_foods UUID[],         -- references foods.id

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diet_profile_active ON diet_profiles(user_id) WHERE is_active = TRUE;

-- Computed macro targets (one per active diet_profile)
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
  rationale_json JSONB,         -- structured explanation for the rationale screen
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food database (Tunisian-focused)
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  category TEXT NOT NULL,        -- 'grain', 'protein', 'dairy', 'vegetable', 'fruit', 'fat', 'prepared', 'snack', 'drink'
  calories_per_100g NUMERIC(6,1) NOT NULL,
  protein_per_100g NUMERIC(5,1) NOT NULL,
  carbs_per_100g NUMERIC(5,1) NOT NULL,
  fat_per_100g NUMERIC(5,1) NOT NULL,
  fiber_per_100g NUMERIC(5,1) DEFAULT 0,
  typical_serving_g NUMERIC(6,1),
  price_tnd_per_kg NUMERIC(6,2),
  price_tier TEXT CHECK (price_tier IN ('low', 'medium', 'high')),
  allergens TEXT[],              -- ['lactose', 'gluten', ...]
  tags TEXT[],                   -- ['vegetarian', 'halal', 'high_protein']
  is_common BOOLEAN DEFAULT FALSE,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_foods_search ON foods USING GIN(search_vector);
CREATE INDEX idx_foods_trgm_fr ON foods USING GIN(name_fr gin_trgm_ops);
CREATE INDEX idx_foods_trgm_ar ON foods USING GIN(name_ar gin_trgm_ops);
CREATE INDEX idx_foods_category ON foods(category);
CREATE INDEX idx_foods_common ON foods(is_common) WHERE is_common = TRUE;

-- Composite dishes (couscous, lablabi, ojja, etc.)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  category TEXT,
  typical_serving_g NUMERIC(6,1),
  -- aggregated macros computed from ingredients
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

-- User custom foods
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

-- Generated meal plan (one active per user, history kept via version)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  diet_profile_id UUID NOT NULL REFERENCES diet_profiles(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  user_modified BOOLEAN DEFAULT FALSE,
  warnings_acknowledged JSONB    -- log of overrides
);

CREATE INDEX idx_meal_plans_active ON meal_plans(user_id) WHERE is_active = TRUE;

-- A meal plan contains meals (breakfast, lunch, dinner, snack — one row per meal slot per day)
CREATE TABLE meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,        -- supports multi-day plans later
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack_1', 'snack_2')),
  order_index INTEGER NOT NULL
);

-- Items inside each meal (a food or recipe, with quantity)
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

CREATE INDEX idx_meal_items_meal ON meal_plan_items(meal_id);
```

### Workout Maker tables

```sql
-- Workout-specific answers
CREATE TABLE training_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 6),
  session_minutes INTEGER DEFAULT 60,
  equipment TEXT NOT NULL CHECK (equipment IN ('full_gym', 'home_basic', 'home_advanced', 'bodyweight')),
  experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  injuries TEXT[],               -- ['shoulder', 'knee', 'lower_back', 'wrist', 'elbow']
  goal TEXT NOT NULL CHECK (goal IN ('lose_fat', 'build_muscle', 'get_stronger', 'general_fitness')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_profile_active ON training_profiles(user_id) WHERE is_active = TRUE;

-- Exercise library
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  name_fr TEXT,
  primary_muscle TEXT NOT NULL CHECK (primary_muscle IN ('chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'core', 'forearms')),
  secondary_muscles TEXT[],
  equipment TEXT NOT NULL CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band')),
  movement_pattern TEXT,         -- 'push', 'pull', 'squat', 'hinge', 'carry', 'rotation'
  difficulty TEXT DEFAULT 'intermediate',
  contraindicated_for TEXT[],    -- ['shoulder', 'knee', 'lower_back']
  video_url TEXT,
  thumbnail_url TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercises_muscle ON exercises(primary_muscle);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);

-- Program templates (curated)
CREATE TABLE program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  split_type TEXT NOT NULL,      -- 'full_body', 'upper_lower', 'ppl', 'ppl_upper', 'bro_split'
  days_per_week INTEGER NOT NULL,
  goal TEXT NOT NULL,
  experience TEXT NOT NULL,
  equipment_required TEXT NOT NULL,
  description TEXT,
  rationale_template JSONB,      -- key/value pairs for rationale screen
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_name TEXT NOT NULL,        -- 'Push', 'Pull', 'Legs', 'Upper'
  UNIQUE(template_id, day_number)
);

CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  rep_range TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER DEFAULT 90,
  notes TEXT
);

-- User's active program (snapshot of a template, fully editable)
CREATE TABLE user_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  training_profile_id UUID NOT NULL REFERENCES training_profiles(id),
  source_template_id UUID REFERENCES program_templates(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  name TEXT NOT NULL,
  split_type TEXT NOT NULL,
  user_modified BOOLEAN DEFAULT FALSE,
  warnings_acknowledged JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_programs_active ON user_programs(user_id) WHERE is_active = TRUE;

CREATE TABLE user_program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_id UUID NOT NULL REFERENCES user_programs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_name TEXT NOT NULL,
  UNIQUE(user_program_id, day_number)
);

CREATE TABLE user_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_day_id UUID NOT NULL REFERENCES user_program_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  rep_range TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER DEFAULT 90,
  is_user_modified BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE INDEX idx_user_program_ex_day ON user_program_exercises(user_program_day_id, order_index);
```

### Workout logging (post-MVP, but schema ready)

```sql
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_program_day_id UUID REFERENCES user_program_days(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  weight_kg NUMERIC(5,1),
  reps INTEGER NOT NULL,
  rpe NUMERIC(3,1),
  is_warmup BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_sets_session ON workout_sets(session_id);
```

### Q&A Library

```sql
CREATE TABLE qa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,     -- 'nutrition', 'training', 'recovery', 'mindset'
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE qa_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES qa_categories(id),
  question_fr TEXT NOT NULL,
  question_ar TEXT,
  answer_short TEXT NOT NULL,    -- the headline answer
  answer_long_md TEXT,           -- markdown with detailed explanation
  visual_type TEXT,              -- 'illustration', 'chart', 'comparison', 'none'
  visual_data JSONB,             -- structured data for the visual component
  scientific_sources JSONB,      -- array of references
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_cards_published ON qa_cards(order_index) WHERE is_published = TRUE;
```

### Row Level Security

```sql
-- Owner-only tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE diet_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_diet_profile" ON diet_profiles FOR ALL USING (auth.uid() = user_id);

ALTER TABLE macro_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_macros" ON macro_targets FOR ALL USING (
  auth.uid() = (SELECT user_id FROM diet_profiles WHERE id = macro_targets.diet_profile_id)
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_plans" ON meal_plans FOR ALL USING (auth.uid() = user_id);

ALTER TABLE meal_plan_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_plan_meals" ON meal_plan_meals FOR ALL USING (
  auth.uid() = (SELECT user_id FROM meal_plans WHERE id = meal_plan_meals.meal_plan_id)
);

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_plan_items" ON meal_plan_items FOR ALL USING (
  auth.uid() = (
    SELECT mp.user_id FROM meal_plans mp
    JOIN meal_plan_meals mpm ON mpm.meal_plan_id = mp.id
    WHERE mpm.id = meal_plan_items.meal_id
  )
);

ALTER TABLE user_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_foods" ON user_foods FOR ALL USING (auth.uid() = user_id);

ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_training_profile" ON training_profiles FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_programs" ON user_programs FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_program_days" ON user_program_days FOR ALL USING (
  auth.uid() = (SELECT user_id FROM user_programs WHERE id = user_program_days.user_program_id)
);

ALTER TABLE user_program_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_program_exercises" ON user_program_exercises FOR ALL USING (
  auth.uid() = (
    SELECT up.user_id FROM user_programs up
    JOIN user_program_days upd ON upd.user_program_id = up.id
    WHERE upd.id = user_program_exercises.user_program_day_id
  )
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON workout_sessions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sets" ON workout_sets FOR ALL USING (
  auth.uid() = (SELECT user_id FROM workout_sessions WHERE id = workout_sets.session_id)
);

-- Public read tables
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods_public_read" ON foods FOR SELECT USING (TRUE);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_public_read" ON recipes FOR SELECT USING (TRUE);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_ingredients_public_read" ON recipe_ingredients FOR SELECT USING (TRUE);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_public_read" ON exercises FOR SELECT USING (TRUE);

ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_public_read" ON program_templates FOR SELECT USING (TRUE);

ALTER TABLE template_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_days_public_read" ON template_days FOR SELECT USING (TRUE);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_exercises_public_read" ON template_exercises FOR SELECT USING (TRUE);

ALTER TABLE qa_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_cat_public_read" ON qa_categories FOR SELECT USING (TRUE);

ALTER TABLE qa_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_cards_public_read" ON qa_cards FOR SELECT USING (is_published = TRUE);
```

### Search vector triggers

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION foods_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.name_fr, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name_en, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER foods_search_trigger
  BEFORE INSERT OR UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION foods_search_update();

-- Same for recipes
CREATE OR REPLACE FUNCTION recipes_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.name_fr, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name_en, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_search_trigger
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION recipes_search_update();
```

---

## 4. The Question Flow Pattern

Every Maker section uses the same client-side wizard pattern. One question per screen, large tappable cards, smooth transitions, progress dots at top.

### Diet Maker — simplified question list

The goal of each question is to feed the algorithm. **Never use jargon.**

1. **"Are you a man or a woman?"** → gender (affects BMR formula)
2. **"How old are you?"** → birth_date (affects BMR)
3. **"How tall are you?"** → height_cm
4. **"What's your weight right now?"** → weight_kg
5. **"What do you want?"** — options as cards with images:
   - "Lose fat" → goal: lose_fat
   - "Stay the same but get healthier" → goal: maintain
   - "Build muscle" → goal: build_muscle
   - "Lose fat and build muscle at the same time" → goal: recomp
6. **"How does your day usually look?"**:
   - "I sit most of the day (office, study)" → sedentary
   - "I walk a bit, light movement" → light
   - "I'm on my feet often" → moderate
   - "Physical job or training daily" → active
   - "Very physical job + training" → very_active
7. **"How many times a day do you usually eat?"** → meals_per_day (2-5)
8. **"What's your food budget like?"**:
   - "Tight, I need cheap options" → low
   - "Normal, comfortable" → medium
   - "Not a concern" → high
9. **"Anything you can't eat?"** (multi-select) → allergies
10. **"Any way of eating you follow?"** → dietary_restriction
11. **"Anything you really don't like?"** (optional, food search) → disliked_foods

### Workout Maker — simplified question list

1. **"What do you want from training?"**:
   - "Look leaner" → goal: lose_fat
   - "Build muscle" → goal: build_muscle
   - "Get stronger" → goal: get_stronger
   - "Just feel good and healthy" → goal: general_fitness
2. **"How many days a week can you train?"** → days_per_week (2-6)
3. **"How long can a session be?"** → session_minutes (30/45/60/75/90)
4. **"Where will you train?"**:
   - "Full gym" → full_gym
   - "Home with some equipment (dumbbells, bands)" → home_basic
   - "Home with a serious setup" → home_advanced
   - "Just my body, no equipment" → bodyweight
5. **"Have you trained before?"**:
   - "Never, or stopped a long time ago" → beginner
   - "I've trained on and off for a while" → intermediate
   - "I train consistently for years" → advanced
6. **"Anything that hurts or that you need to be careful with?"** (multi-select) → injuries

---

## 5. Generation Algorithms

### Macro calculation (server action `actions/diet.ts → calculateMacros()`)

```typescript
function calculateMacros(profile: DietProfile): MacroTargets {
  const age = differenceInYears(new Date(), profile.birth_date);
  const w = profile.weight_kg;
  const h = profile.height_cm;

  // Mifflin-St Jeor
  const bmr = profile.gender === 'male'
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161;

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = Math.round(bmr * multipliers[profile.activity_level]);

  const goalAdjust = { lose_fat: -500, maintain: 0, build_muscle: 300, recomp: -200 };
  const calories = Math.max(1200, tdee + goalAdjust[profile.goal]);

  const proteinPerKg = profile.goal === 'build_muscle' ? 2.2
                    : profile.goal === 'lose_fat' ? 2.0
                    : profile.goal === 'recomp' ? 2.2 : 1.8;
  const protein_g = Math.round(w * proteinPerKg);

  const fat_g = Math.round(calories * 0.25 / 9);
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);
  const fiber_g = Math.round(calories / 1000 * 14);

  const rationale_json = {
    bmr_explanation: `Your body burns about ${Math.round(bmr)} kcal just to exist (breathing, organs, brain).`,
    tdee_explanation: `Add your daily activity and you burn around ${tdee} kcal per day.`,
    target_explanation: goalAdjust[profile.goal] === 0
      ? `To stay the same, you eat what you burn: ${calories} kcal.`
      : goalAdjust[profile.goal] < 0
        ? `To lose fat steadily, we cut ${Math.abs(goalAdjust[profile.goal])} kcal from your daily burn — that's ${calories} kcal/day.`
        : `To build muscle, we add ${goalAdjust[profile.goal]} kcal — that's ${calories} kcal/day.`,
    protein_explanation: `${protein_g}g protein keeps your muscle while you ${profile.goal === 'lose_fat' ? 'lose fat' : 'build'}.`,
    fat_explanation: `${fat_g}g fat keeps your hormones and energy steady.`,
    carbs_explanation: `${carbs_g}g carbs fuel your training and brain.`
  };

  return { bmr: Math.round(bmr), tdee, calories, protein_g, carbs_g, fat_g, fiber_g, rationale_json };
}
```

### Meal plan generation (server action `actions/diet.ts → generateMealPlan()`)

Strategy: greedy fill, respect constraints, prefer recipes when budget allows.

```
1. Filter foods + recipes:
   - Remove disliked_foods
   - Remove items containing user allergens
   - Filter by dietary_restriction (vegetarian = no meat tagged items)
   - Filter by budget_level (low → only price_tier 'low' or 'medium')

2. Split daily macros across meals:
   - Breakfast: 25% calories
   - Lunch: 35% calories
   - Dinner: 30% calories
   - Snacks: 10% / number of snacks

3. For each meal slot:
   - Start with a protein source (closest match to meal protein target)
   - Add a carb source (closest match)
   - Add a fat source
   - Add vegetables/fruits for fiber
   - Adjust quantities to hit macros within ±10% tolerance

4. Apply Tunisian meal-pattern preferences:
   - Breakfast: include dairy or bread
   - Lunch: bigger meal, often a dish (couscous, mloukhia)
   - Dinner: lighter
   - Use recipes for lunch/dinner when budget allows

5. Save to meal_plan_meals + meal_plan_items
```

### Workout program matching (server action `actions/training.ts → generateProgram()`)

```
1. Match training_profile to program_templates:
   - Filter templates by days_per_week, equipment_required, experience, goal
   - Score remaining by overlap; pick highest

2. Clone the template:
   - For each template_day → user_program_day
   - For each template_exercise → user_program_exercise

3. Apply injury filter:
   - For each exercise, check if any user injury is in contraindicated_for
   - If yes, swap with a same-muscle exercise that doesn't conflict
   - If no clean swap exists, flag the exercise with notes: "Be careful, consult coach"

4. Save and return with rationale
```

### Rationale generator (workout)

```typescript
function generateWorkoutRationale(profile: TrainingProfile, template: ProgramTemplate): RationaleData {
  return {
    why_this_split: `You said ${profile.days_per_week} days and ${profile.equipment === 'full_gym' ? 'full gym access' : 'home training'}. ${template.split_type === 'ppl' ? 'Push/Pull/Legs splits your week so each muscle group recovers fully while you train another.' : '...'}`,
    why_this_volume: `For ${profile.experience}s, ${template.split_type} hits each muscle ${template.days_per_week >= 4 ? 'twice' : 'once'} per week, which research shows is optimal for ${profile.goal === 'build_muscle' ? 'muscle growth' : 'strength'}.`,
    why_these_exercises: `Every session starts with a compound lift (works many muscles at once) then isolates the smaller muscles.`,
    injury_adjustments: profile.injuries.length > 0
      ? `We swapped a few exercises because of your ${profile.injuries.join(', ')}.`
      : null
  };
}
```

---

## 6. Validation Layer (warnings, not blocks)

After every edit, the client posts the new plan state to a validation server action. It returns warnings:

```typescript
// actions/validation.ts
export async function validateMealPlan(plan: MealPlanState): Promise<Warning[]> {
  const target = await getMacroTarget(plan.dietProfileId);
  const totals = computeTotals(plan);
  const warnings: Warning[] = [];

  if (totals.protein_g < target.protein_g * 0.8) {
    warnings.push({
      severity: 'warning',
      type: 'low_protein',
      message: `Protein is ${totals.protein_g}g — recommended ${target.protein_g}g. Low protein slows muscle recovery.`
    });
  }
  if (totals.calories > target.calories * 1.15) {
    warnings.push({
      severity: 'warning',
      type: 'over_calories',
      message: `You're ${totals.calories - target.calories} kcal over your target.`
    });
  }
  // ... more checks
  return warnings;
}

export async function validateProgram(program: ProgramState): Promise<Warning[]> {
  const warnings: Warning[] = [];
  const muscleCoverage = countMuscleGroups(program);

  if (muscleCoverage.chest === 0) warnings.push({ severity: 'warning', type: 'no_chest', message: 'No chest exercises this week.' });
  if (muscleCoverage.back === 0) warnings.push({ severity: 'warning', type: 'no_back', message: 'No back exercises this week.' });
  // ... more checks
  return warnings;
}
```

UI: warnings render as yellow banners on the editor. Saving with warnings present writes them to `warnings_acknowledged` JSONB so you can analyze patterns later.

---

## 7. Caching Strategy

**Layer 1 — Vercel CDN**: SSG/ISR pages cached at edge. Landing, pricing, Q&A library shell.

**Layer 2 — React Query** (client):
```typescript
export const queryKeys = {
  diet: {
    plan: (userId: string) => ['diet', 'plan', userId],
    macros: (userId: string) => ['diet', 'macros', userId],
  },
  training: {
    program: (userId: string) => ['training', 'program', userId],
  },
  foods: {
    search: (q: string) => ['foods', 'search', q],
    popular: () => ['foods', 'popular'],
  },
  qa: {
    all: () => ['qa', 'all'],
    category: (slug: string) => ['qa', 'category', slug],
  },
};

const STALE = {
  STATIC: 1000 * 60 * 60,        // 1h — foods, exercises, Q&A
  USER_PLAN: 1000 * 60 * 5,      // 5m — meal plan, program
  REALTIME: 0,                    // editor state
};
```

**Layer 3 — Supabase pooler** (PgBouncer URL, not direct).

**Layer 4 — `unstable_cache`** for popular foods, Q&A list.

---

## 8. Folder Structure

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                    # Landing
│   │   ├── pricing/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (app)/
│   │   ├── layout.tsx                  # Auth guard + nav
│   │   ├── dashboard/page.tsx          # 3 section cards
│   │   │
│   │   ├── diet/
│   │   │   ├── page.tsx                # Landing: shows current plan or "Start" CTA
│   │   │   ├── questions/page.tsx      # Wizard (client)
│   │   │   ├── rationale/page.tsx      # Why we chose this (RSC)
│   │   │   ├── plan/page.tsx           # Editable plan (client)
│   │   │   └── history/page.tsx        # Previous versions
│   │   │
│   │   ├── workout/
│   │   │   ├── page.tsx
│   │   │   ├── questions/page.tsx
│   │   │   ├── rationale/page.tsx
│   │   │   ├── program/page.tsx
│   │   │   └── history/page.tsx
│   │   │
│   │   ├── qa/
│   │   │   ├── page.tsx                # TikTok-style feed
│   │   │   └── [slug]/page.tsx         # Direct link to a card
│   │   │
│   │   └── settings/page.tsx
│   │
│   ├── api/
│   │   ├── foods/search/route.ts
│   │   └── webhook/payment/route.ts
│   │
│   ├── actions/
│   │   ├── diet.ts                     # generate, save, validate, redo
│   │   ├── training.ts                 # generate, save, validate, redo
│   │   ├── auth.ts
│   │   └── payment.ts
│   │
│   ├── login/page.tsx
│   └── checkout/page.tsx
│
├── components/
│   ├── ui/                             # shadcn primitives from theme starter
│   ├── shared/
│   │   ├── question-wizard.tsx         # generic step wizard
│   │   ├── rationale-card.tsx
│   │   └── warning-banner.tsx
│   ├── diet/
│   │   ├── macro-ring.tsx
│   │   ├── meal-card.tsx
│   │   ├── food-search.tsx
│   │   └── plan-editor.tsx
│   ├── workout/
│   │   ├── exercise-card.tsx
│   │   ├── program-day.tsx
│   │   └── program-editor.tsx
│   └── qa/
│       ├── qa-feed.tsx                 # vertical swiper
│       └── qa-card.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── algorithms/
│   │   ├── macros.ts
│   │   ├── meal-plan-gen.ts
│   │   ├── program-match.ts
│   │   └── validation.ts
│   ├── queries.ts
│   └── utils.ts
│
├── hooks/
│   ├── use-debounced-value.ts
│   ├── use-meal-plan-totals.ts
│   └── use-swipe.ts
│
├── types/
│   └── db.ts                           # generated from Supabase
│
└── middleware.ts
```

---

## 9. Auth & Payment

```
1. Landing → CTA → /checkout
2. /checkout → Konnect/Flouci → webhook → mark profiles.has_paid = TRUE
3. Webhook redirects to /signup (sets up account using payment email)
4. middleware checks: session + has_paid before allowing /diet, /workout, /qa
5. First-time user lands on /dashboard with 3 section cards, each prompting questions
```

**Middleware uses `getUser()`** (server-validated), not `getSession()`.

---

## 10. Theme Integration

The user has an existing theme starter repo with:
- shadcn/ui components in `src/components/ui/`
- Tailwind config with custom colors
- Global CSS with design tokens

**Rules for Claude Code:**
- Do not overwrite existing UI primitives in `src/components/ui/`
- Use the existing Tailwind tokens for all styling
- Build feature components in `src/components/{diet,workout,qa,shared}/` using those primitives
- Follow the existing typography and spacing scale

---

## 11. Demo Content Strategy

For MVP and validation:
- Seed `foods` with ~50 common Tunisian items (placeholder macros if needed)
- Seed `recipes` with ~10 dishes (couscous, lablabi, ojja, brik, mloukhia, shorba, salade méchouia, kafteji, slata tounsia, makroudh)
- Seed `exercises` with ~80 common lifts (text only, video_url empty)
- Seed `program_templates` with ~6 templates covering all (days × experience × equipment) combos
- Seed `qa_cards` with 12-15 placeholder cards (real questions, short answers, visual_data empty for now)

Mark all seed data with `is_demo: true` in metadata if you want a fast purge later.

---

## 12. Performance Checklist

- [ ] All RSC pages under 200ms TTFB
- [ ] Food search returns in < 100ms (GIN + trigram + edge)
- [ ] Question wizard transitions < 100ms (no DB hit between steps)
- [ ] Meal plan editor recalculates totals in < 50ms (client-side math)
- [ ] Q&A swiper feels native (preload next 2 cards)
- [ ] PgBouncer connection string everywhere
- [ ] RLS on every owner-only table
- [ ] Middleware uses `getUser()`, not `getSession()`
- [ ] Loading skeletons on every (app)/ route
- [ ] Error boundaries on every section

---

## 13. Development Order

**Phase 1 — Foundation (3-4 days)**
- Supabase schema + RLS + triggers
- Seed demo data (foods, recipes, exercises, templates, Q&A)
- Auth flow + middleware + payment webhook (test mode)
- Theme integration check

**Phase 2 — Diet Maker (4-5 days)**
- Question wizard component (reusable)
- Diet questions flow
- Macro calculation + rationale screen
- Meal plan generation algorithm
- Meal plan editor (food search, swap, edit quantity, live totals)
- Validation warnings
- "Redo my goals" flow with version archive

**Phase 3 — Workout Maker (3-4 days)**
- Workout questions flow
- Program matching + cloning + injury swap
- Rationale screen
- Program editor (swap exercise, edit sets/reps)
- Validation warnings
- "Redo my goals" flow

**Phase 4 — Q&A Library (2 days)**
- TikTok-style vertical swiper
- Card component with markdown + visual slot
- Category filtering
- Direct-link routing

**Phase 5 — Dashboard + Polish (2 days)**
- Dashboard with 3 section cards
- Settings page
- Landing + pricing page
- Lighthouse + perf pass

**Phase 6 — Live Launch**
- Payment in production mode
- Deploy to Vercel
- Smoke test full flow

---

## 14. Cost Projection

| Users | Vercel | Supabase | Total/month |
|-------|--------|----------|-------------|
| 0–1k | $20 | $25 | ~$45 |
| 1k–5k | $20 | $25 | ~$45 |
| 5k–10k | $30 | $40 | ~$70 |
| 10k–25k | $40 | $75 | ~$115 |

At 49 TND ($15) per user, 1,000 users = $15k revenue against $45 infra. Margins are huge.
