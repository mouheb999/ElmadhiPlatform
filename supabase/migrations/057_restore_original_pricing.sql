-- 057_restore_original_pricing.sql
-- Back to the original prices: 1 / 3 / 6 months at 49 / 129 / 219 DT (the
-- premium rows migration 017 shipped), replacing 052's 20 / 54 / 96 / 168.
-- Still one offer on the `premium` tier, so plan_type, the /ai gate and
-- confirmPayment's (tier, months) check are untouched. Re-runnable.

-- ---------- The offer ----------
-- Per term, not per month: 49, 43 and 36.5 DT a month.
INSERT INTO subscription_plans (tier, months, price_tnd) VALUES
  ('premium', 1,  49),
  ('premium', 3, 129),   -- 43 DT/mo — save 18 DT
  ('premium', 6, 219)    -- 36.5 DT/mo — save 75 DT
ON CONFLICT (tier, months) DO UPDATE
  SET price_tnd = EXCLUDED.price_tnd,
      is_enabled = TRUE,
      updated_at = NOW();

-- ---------- Twelve months is no longer on sale ----------
-- Kept rather than deleted, like Standard in 052: resolved requests still name
-- it. The months CHECK still allows 12, so an admin can put it back on sale.
--
-- confirmPayment only confirms plans on sale, so a still-pending 12-month
-- request would become unconfirmable. Those are left alone rather than moved
-- to another term (that would change what somebody paid for) — the notice
-- below says how many there are so an admin can resolve them, re-enabling
-- the 12-month row for the moment it takes if needed.
UPDATE subscription_plans
   SET is_enabled = FALSE,
       updated_at = NOW()
 WHERE tier = 'premium'
   AND months = 12;

DO $$
DECLARE
  pending_12 INT;
BEGIN
  SELECT count(*) INTO pending_12
  FROM payment_requests
  WHERE status = 'pending'
    AND plan_tier = 'premium'
    AND plan_months = 12;
  IF pending_12 > 0 THEN
    RAISE NOTICE '057: % pending 12-month request(s) need resolving by hand', pending_12;
  END IF;
END $$;
