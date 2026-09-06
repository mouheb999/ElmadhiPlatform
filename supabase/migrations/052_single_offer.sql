-- 052_single_offer.sql
-- Two tiers → one offer. Standard and Premium sold the same app with four
-- features moved between them, and checkout opened on a grid asking a stranger
-- to pick a side before they knew what they were buying. There is one product
-- now — full access — priced only by how long you commit: 1, 3, 6 or 12 months.
--
-- It stays on the `premium` tier on purpose. `profiles.plan_type`, the /ai gate
-- and `confirmPayment`'s (tier, months) check all read that value, so selling
-- the merged offer as premium means everyone who buys gets everything and no
-- access code has to change. Re-runnable.

-- ---------- A twelve-month term ----------
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_months_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_months_check CHECK (months IN (1, 3, 6, 12));

-- ---------- The offer ----------
-- Prices are per term, not per month: 20 / 18 / 16 / 14 DT a month, so the
-- saving on a longer term is checkable against the one-month row.
INSERT INTO subscription_plans (tier, months, price_tnd) VALUES
  ('premium',  1,  20),
  ('premium',  3,  54),   -- 18 DT/mo — save 6 DT
  ('premium',  6,  96),   -- 16 DT/mo — save 24 DT
  ('premium', 12, 168)    -- 14 DT/mo — save 72 DT
ON CONFLICT (tier, months) DO UPDATE
  SET price_tnd = EXCLUDED.price_tnd,
      is_enabled = TRUE,
      updated_at = NOW();

-- ---------- In-flight Standard orders, before Standard stops being sold ----
-- `confirmPayment` refuses a request whose (tier, months) is not a plan on
-- sale, and rightly so — it is what stops a hand-crafted row granting 24
-- months. Retiring Standard underneath somebody who has already transferred
-- money would make their request unconfirmable, so the open ones move to the
-- merged offer first: same term, same money, more app.
UPDATE payment_requests
   SET plan_tier = 'premium',
       plan_months = COALESCE(plan_months, 1)
 WHERE status = 'pending'
   AND plan_tier = 'standard';

-- ---------- Standard is no longer on sale ----------
-- Kept rather than deleted: resolved requests still name it, and the admin
-- queue reads those rows when it shows what an old payment was for.
UPDATE subscription_plans
   SET is_enabled = FALSE,
       updated_at = NOW()
 WHERE tier = 'standard';

-- Existing Standard subscribers are deliberately left alone. Their
-- `plan_type` stays 'standard' until the term they paid for runs out, at which
-- point they renew onto the one offer like everybody else; silently rewriting
-- what somebody already bought is not this migration's call to make.
