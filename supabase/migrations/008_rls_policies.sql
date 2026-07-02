-- 008_rls_policies.sql
-- Row Level Security. Owner-only for user data, public read for content tables.

-- ---------- Owner-only tables ----------
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

-- ---------- Public read content tables ----------
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
