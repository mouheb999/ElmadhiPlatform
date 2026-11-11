-- 059_push_subscriptions.sql
-- Where a reminder can be sent: one row per browser a member has switched
-- notifications on in.
--
-- A subscription is what the browser's push service hands back when the member
-- allows notifications — an endpoint URL and two keys. It identifies a browser
-- on a device, not a person, so one member can hold several (phone and laptop)
-- and they are simply all sent to.
--
-- The row existing IS the setting. There is no separate "notifications on"
-- flag to drift out of step with reality: switching reminders off in Settings
-- deletes the row, and a push service reporting the endpoint gone deletes it
-- too.
--
-- `last_sent_at` and `last_kind` are what stop the daily job repeating itself:
-- at most one reminder per browser per day, and the same nudge is not sent two
-- days running.
--
-- Members can create, read and delete their own rows. They cannot UPDATE one —
-- the two bookkeeping columns are written by the reminder job through the
-- service role, and nothing else about a subscription ever changes.
--
-- Additive; safe to apply before the code that uses it. Re-runnable.

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- The language the member was reading when they switched reminders on, so a
  -- notification arrives in it without a profile lookup per send.
  locale TEXT NOT NULL DEFAULT 'tn' CHECK (locale IN ('tn', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  last_kind TEXT
);

-- An endpoint is a URL on a known push service; refuse anything else being
-- parked in the column, and anything absurdly long.
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_shape;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_shape
  CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select ON push_subscriptions;
CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS push_subscriptions_insert ON push_subscriptions;
CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS push_subscriptions_delete ON push_subscriptions;
CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;

COMMENT ON TABLE push_subscriptions IS
  'Browsers a member has allowed reminders in. Row present = reminders on. Written by the member (insert/delete) and by the reminder job via the service role.';

COMMIT;
