-- 060_prices_39_89_149.sql
-- New prices for the one offer: 39 / 89 / 149 DT for 1 / 3 / 6 months
-- (was 49 / 129 / 219). The three-month term is the 90-day challenge.
--
-- Per month that is 39, 29.7 and 24.8 DT. Still the `premium` tier, so
-- plan_type, the /ai gate and confirmPayment's (tier, months) check are
-- untouched, and nothing else is put on or taken off sale.
--
-- Requests already open keep the amount they were started at:
-- `activateRequest` confirms a plan by tier and term, not by price, so an
-- older request at the older price is still a normal thing to confirm.
--
-- Re-runnable.

UPDATE subscription_plans
   SET price_tnd = CASE months WHEN 1 THEN 39 WHEN 3 THEN 89 WHEN 6 THEN 149 END,
       updated_at = NOW()
 WHERE tier = 'premium'
   AND months IN (1, 3, 6);
