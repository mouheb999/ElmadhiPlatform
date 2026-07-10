-- 017_subscriptions.sql
-- Pricing switch: one-time unlock → Standard/Premium subscriptions in
-- 1/3/6-month terms. The manual flow (method → WhatsApp → admin activates)
-- is unchanged; requests now carry the chosen plan and activation stamps a
-- tier + expiry on the profile. Re-runnable.

-- ---------- Plans (admin-editable prices; longer terms earn a discount) ----
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'premium')),
  months INTEGER NOT NULL CHECK (months IN (1, 3, 6)),
  price_tnd NUMERIC(8,2) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tier, months)
);

INSERT INTO subscription_plans (tier, months, price_tnd) VALUES
  ('standard', 1,  29),
  ('standard', 3,  69),   -- 23 DT/mo — save 21%
  ('standard', 6, 119),   -- ~19.9 DT/mo — save 32%
  ('premium',  1,  49),
  ('premium',  3, 129),   -- 43 DT/mo — save 12%
  ('premium',  6, 219)    -- 36.5 DT/mo — save 25%
ON CONFLICT (tier, months) DO NOTHING;

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_public_read" ON subscription_plans;
CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT USING (is_enabled = TRUE);

-- ---------- Requests carry the chosen plan ----------
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS plan_tier TEXT,
  ADD COLUMN IF NOT EXISTS plan_months INTEGER;

-- ---------- Profiles: allow the 'standard' tier ----------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IN ('free', 'standard', 'premium'));
