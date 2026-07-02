-- 006_indexes.sql
-- All indexes, consolidated. Requires tables (003-005) and pg_trgm (001).

-- Diet
CREATE INDEX idx_diet_profile_active ON diet_profiles(user_id) WHERE is_active = TRUE;

CREATE INDEX idx_foods_search ON foods USING GIN(search_vector);
CREATE INDEX idx_foods_trgm_fr ON foods USING GIN(name_fr gin_trgm_ops);
CREATE INDEX idx_foods_trgm_ar ON foods USING GIN(name_ar gin_trgm_ops);
CREATE INDEX idx_foods_trgm_en ON foods USING GIN(name_en gin_trgm_ops);
CREATE INDEX idx_foods_category ON foods(category);
CREATE INDEX idx_foods_common ON foods(is_common) WHERE is_common = TRUE;

CREATE INDEX idx_recipes_search ON recipes USING GIN(search_vector);

CREATE INDEX idx_meal_plans_active ON meal_plans(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_meal_items_meal ON meal_plan_items(meal_id);

-- Workout
CREATE INDEX idx_training_profile_active ON training_profiles(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_exercises_muscle ON exercises(primary_muscle);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);
CREATE INDEX idx_user_programs_active ON user_programs(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_program_ex_day ON user_program_exercises(user_program_day_id, order_index);

CREATE INDEX idx_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_sets_session ON workout_sets(session_id);

-- Q&A
CREATE INDEX idx_qa_cards_published ON qa_cards(order_index) WHERE is_published = TRUE;
