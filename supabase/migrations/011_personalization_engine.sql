-- 011_personalization_engine.sql
-- Schema deltas from personalization-engine.md §9 (three-layer decision engine:
-- hard filters / template lookup / preference scoring). Additive only.

-- ---------- Layer-1 filter data: exercise substitution groups ----------
-- Movement-pattern group (e.g. 'incline_press', 'leg_curl') from the source
-- material's equipment-substitution table. Exercises in the same group target
-- the same muscle and are interchangeable when the default is unavailable or
-- contraindicated. NULL until the admin/seed data assigns one.
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS substitution_group TEXT;

CREATE INDEX IF NOT EXISTS idx_exercises_substitution_group
  ON exercises(substitution_group);

-- ---------- Diet Maker deep-dive fields (optional questionnaire, §7) ----------
ALTER TABLE diet_profiles
  ADD COLUMN IF NOT EXISTS ramadan_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cooking_skill TEXT
    CHECK (cooking_skill IN ('none', 'basic', 'comfortable')),
  ADD COLUMN IF NOT EXISTS favorite_foods UUID[],
  -- Rule D1 (personalization-engine.md §5): the intensity within a goal.
  -- 'normal' is always the default; 'aggressive' (cut) and 'dirty' (bulk) are
  -- opt-in only, gated behind a warning in the UI, never pre-selected.
  ADD COLUMN IF NOT EXISTS diet_intensity TEXT NOT NULL DEFAULT 'normal'
    CHECK (diet_intensity IN ('normal', 'aggressive', 'clean', 'dirty'));

-- ---------- Workout Maker deep-dive fields (optional questionnaire, §7) ----------
ALTER TABLE training_profiles
  ADD COLUMN IF NOT EXISTS favorite_exercises UUID[],
  ADD COLUMN IF NOT EXISTS weak_muscles TEXT[],
  ADD COLUMN IF NOT EXISTS consistency_self_rating INTEGER
    CHECK (consistency_self_rating BETWEEN 1 AND 5);

-- ---------- Q&A user-submitted questions (§8) ----------
CREATE TABLE IF NOT EXISTS qa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'dismissed')),
  promoted_qa_card_id UUID REFERENCES qa_cards(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_requests_status
  ON qa_requests(status, created_at DESC);

ALTER TABLE qa_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_qa_requests_insert" ON qa_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_qa_requests_select" ON qa_requests
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- Q&A: add the 4th category shown in the mockups ----------
INSERT INTO qa_categories (slug, name_en, name_ar, order_index)
VALUES ('supplements', 'Supplements', 'المكملات الغذائية', 4)
ON CONFLICT (slug) DO NOTHING;
