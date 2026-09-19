-- 056_meta_attribution.sql
-- What the Meta Conversions API needs to tie a sale back to the ad click.
--
-- The Purchase event is sent when an admin activates the account, not when the
-- customer pays, and that can be hours later from a different browser. By then
-- the only link between the sale and the ad is what the customer's own browser
-- carried at checkout: Meta's first-party cookies (_fbp, _fbc) plus their IP
-- and user agent. So those are captured by `startPaymentRequest` and stored on
-- the request row, and `activateRequest` sends them with the Purchase.
--
-- Nothing here is shown in the UI. Written by the server only (the service-role
-- client on update, the user's own insert on first request, both through
-- `startPaymentRequest`).
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS meta_fbp TEXT,
  ADD COLUMN IF NOT EXISTS meta_fbc TEXT,
  ADD COLUMN IF NOT EXISTS client_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT;

COMMIT;
