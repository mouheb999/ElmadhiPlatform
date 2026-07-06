-- 015_adaptations.sql
-- V2 slice 1: the adaptation audit trail. Every automatic plan change the
-- rules engine makes (or proposes) is recorded here with its reason key and
-- before/after payload — this is what makes "why did my plan change?" always
-- answerable, and what enforces the one-adjustment-per-week cooldown.

CREATE TABLE IF NOT EXISTS plan_adaptations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diet', 'workout')),
  -- i18n key of the rule that fired (e.g. 'adapt.cut_stall'). The
  -- explanation shown to the user is this key's template, not free text.
  reason_key TEXT NOT NULL,
  -- Before/after numbers, e.g. {old_calories, new_calories, trend_kg, ...}
  payload JSONB NOT NULL DEFAULT '{}',
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_adaptations_user
  ON plan_adaptations(user_id, kind, applied_at DESC);

ALTER TABLE plan_adaptations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_adaptations_select" ON plan_adaptations;
CREATE POLICY "own_adaptations_select" ON plan_adaptations
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_adaptations_insert" ON plan_adaptations;
CREATE POLICY "own_adaptations_insert" ON plan_adaptations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
