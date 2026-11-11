-- 058_free_access_window.sql
-- Access that is not backed by a confirmed payment: the sign-up trial, and the
-- window while a receipt is being checked.
--
-- THE PROBLEM
--
-- 1,940 visits to /start between 17 September and 10 November produced 4
-- payments. 86% of visitors finished the questionnaire; the funnel lost them
-- at the three steps after it, all of which ask for something before the
-- product has been touched:
--
--   * the price page         — 61% saw it, 10.7% picked a plan
--   * the account form       — 26% of those finished it
--   * the transfer + receipt — 5 receipts from 69 people who reached the step
--
-- And the people who did pay then waited on a human. Seven receipts were
-- uploaded, opened by an admin and never resolved either way.
--
-- THE SHAPE
--
-- One nullable timestamp, `profiles.free_access_until`. While it is in the
-- future the account passes the same gate a paid one does. Two things set it:
--
--   1. Sign-up. The trigger below gives every new account three days, so the
--      first thing a stranger does with the product is use it. The price is
--      met after that, by somebody looking at their own logged meals.
--   2. A receipt. `attachPaymentProof` extends it by 48 hours the moment a
--      screenshot is attached, so nobody who has paid waits to be let in. An
--      admin confirming the request turns that into a real term; rejecting it
--      takes the window back (see `rejectRequest`).
--
-- It is deliberately NOT a new `payment_status` or `plan_type` value. Both
-- carry CHECK constraints and are read by the admin panel as "this person is a
-- customer"; a trial is not a customer and should not be counted as one.
--
-- Existing accounts get NULL: no trial is granted retroactively. Whether the
-- 1,200 accounts that never paid are offered one is a marketing decision, not
-- a side effect of a migration.
--
-- A user cannot set this column themselves: `authenticated` holds UPDATE on
-- (full_name, locale, phone, updated_at) only (migration 039), so it is
-- written by this trigger and by the service role, nothing else.
--
-- APPLY THIS BEFORE DEPLOYING THE CODE THAT READS IT. The gate selects the new
-- column; against a database without it that read fails and every account,
-- paying ones included, is turned away. The migration is additive, so applying
-- it early is harmless to the code that is live today.
--
-- Re-runnable.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_access_until TIMESTAMPTZ;

COMMENT ON COLUMN profiles.free_access_until IS
  'Full access without a confirmed payment until this instant: the sign-up trial, or the window while a receipt is checked. NULL = never granted. Written by handle_new_user and the service role only.';

-- ---------------------------------------------------------------------------
-- 2. Three days at sign-up
-- ---------------------------------------------------------------------------
-- Same trigger as migration 054, with one more column written. The length is
-- duplicated in src/lib/subscription.ts (TRIAL_DAYS) for the copy that names
-- it; if one changes, change the other.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  attribution_json JSONB := NULL;
  funnel_json JSONB := NULL;
BEGIN
  BEGIN
    attribution_json := NULLIF(NEW.raw_user_meta_data->>'attribution', '')::JSONB;
  EXCEPTION WHEN others THEN
    attribution_json := NULL;
  END;

  BEGIN
    funnel_json := NULLIF(NEW.raw_user_meta_data->>'funnel_answers', '')::JSONB;
  EXCEPTION WHEN others THEN
    funnel_json := NULL;
  END;

  INSERT INTO public.profiles (
    id, email, full_name, phone, attribution, funnel_answers, free_access_until
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    attribution_json,
    funnel_json,
    NOW() + INTERVAL '3 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE OR REPLACE drops the SET clause; re-pin it, as 054 and 055 do.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. The paywall predicate, next to the data
-- ---------------------------------------------------------------------------
-- Mirrors `isSubscriptionActive` in src/lib/subscription.ts, which gains the
-- same clause. Without this the app would wave a trial account through and the
-- RESTRICTIVE policies from migration 045 would then refuse every write it
-- made — a trial in which nothing can be logged.
CREATE OR REPLACE FUNCTION public.current_user_is_subscribed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.is_admin
        OR (p.payment_status = 'active'
            AND (p.plan_expires_at IS NULL OR p.plan_expires_at > NOW()))
        OR (p.free_access_until IS NOT NULL AND p.free_access_until > NOW())
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_subscribed() TO authenticated;

COMMIT;
