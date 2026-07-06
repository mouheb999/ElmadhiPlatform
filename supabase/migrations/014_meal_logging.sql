-- 014_meal_logging.sql
-- V1.5 "the app becomes daily": food-diary support. meal_logs itself shipped
-- in 013; this adds the favorites store the quick-log paths read from.

CREATE TABLE IF NOT EXISTS food_favorites (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, food_id)
);

ALTER TABLE food_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_food_favorites" ON food_favorites;
CREATE POLICY "own_food_favorites" ON food_favorites
  FOR ALL USING (auth.uid() = user_id);
