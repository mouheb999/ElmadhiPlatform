-- 061_welcome_back_trial.sql
-- Three free days for the accounts that signed up before the trial existed.
--
-- Migration 058 gives the trial at sign-up, so the 1,200-odd accounts created
-- before it have none: they log in and meet a price, as they did the first
-- time. This lets each of them claim the same three days, once.
--
-- The days start when the member comes back, not when this migration runs —
-- a blanket UPDATE would have spent everybody's trial while they were away.
-- The proxy calls this function the first time such an account reaches the
-- app; it is the only writer, and it can only ever write the caller's own row.
--
-- Only for an account that has never had a window and never paid:
--   free_access_until IS NULL   never had the trial (so it cannot be claimed twice)
--   plan_expires_at IS NULL     never held a subscription — a lapsed customer
--                               is a renewal, and is worded as one
--
-- SECURITY DEFINER because members cannot write that column. It takes no
-- argument and reads auth.uid(), so it cannot be pointed at anyone else.
--
-- Re-runnable.

CREATE OR REPLACE FUNCTION public.claim_welcome_trial()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  granted TIMESTAMPTZ;
BEGIN
  UPDATE public.profiles
     SET free_access_until = NOW() + INTERVAL '3 days'
   WHERE id = auth.uid()
     AND free_access_until IS NULL
     AND plan_expires_at IS NULL
     AND payment_status <> 'active'
  RETURNING free_access_until INTO granted;
  RETURN granted;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_welcome_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_welcome_trial() TO authenticated;
