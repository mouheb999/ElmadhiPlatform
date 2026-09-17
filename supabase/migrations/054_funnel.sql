-- 054_funnel.sql
-- The sign-up funnel: where visitors come from, and where they fall out.
--
-- THE PROBLEM
--
-- Money is about to be spent on ads pointing at this product, and nothing in
-- the schema can answer either of the two questions that spend depends on:
--
--   1. Which ad produced a paying customer? `profiles` records who signed up
--      and when, and nothing about how they arrived. With one campaign running
--      that is survivable; with three creatives it is spending blind.
--   2. Where do people leave? The funnel on /start is eleven questions, a
--      reveal and a paywall. If 80% of a campaign's clicks stop at question
--      four, that is a copy problem with an obvious fix — but only if it is
--      visible. `events` cannot hold this: it requires a user_id, and the
--      whole point of this funnel is that it runs before there is an account.
--
-- THE SHAPE
--
--   profiles.attribution   the ad click that produced the account, copied out
--                          of sign-up metadata by the trigger below.
--   profiles.funnel_answers what they told /start before they had an account,
--                          so the questionnaire can open pre-filled and an
--                          admin chasing a stalled payment can see who they
--                          are talking to.
--   funnel_events          one insert-only row per step reached, anonymous,
--                          keyed by a random per-visit id.
--
-- ON PRIVACY
--
-- `funnel_events` carries no name, no email, no phone, no IP and no device
-- fingerprint: a random id that lives in one browser tab, which step was
-- reached, and the campaign parameters the ad platform itself put in the URL.
-- It is readable only through the service role — there is no SELECT policy, so
-- an anon or authenticated session cannot read a single row back, including
-- its own. INSERT is granted because the visitor writing these rows has no
-- account by definition.
--
-- Re-runnable.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. What the account remembers about where it came from
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS funnel_answers JSONB;

COMMENT ON COLUMN profiles.attribution IS
  'The ad click that produced this account: utm_* plus a click id, as captured on the landing page. Marketing attribution only — nothing reads it for access control.';
COMMENT ON COLUMN profiles.funnel_answers IS
  'The /start answers this account signed up with. Pre-fills the questionnaire; never a source of truth for any number the plan is built from.';

-- Deliberately NOT added to the column whitelist in migration 039. A user has
-- no reason to rewrite their own attribution, and the trigger below writes it
-- with definer rights at creation time, which is the only moment it is true.

-- ---------------------------------------------------------------------------
-- 2. Carry both through sign-up
-- ---------------------------------------------------------------------------
-- Same trigger as migration 039, with two more metadata fields read. The
-- casts are guarded: `raw_user_meta_data` is client-supplied, so a value that
-- is not valid JSON must leave the account creatable rather than take the
-- whole sign-up down with it.
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

  INSERT INTO public.profiles (id, email, full_name, phone, attribution, funnel_answers)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    attribution_json,
    funnel_json
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Which campaign is producing subscribers, not just clicks.
CREATE INDEX IF NOT EXISTS idx_profiles_attribution_source
  ON profiles ((attribution->>'source'))
  WHERE attribution IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. The funnel itself
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funnel_events (
  id BIGSERIAL PRIMARY KEY,
  -- A random id minted in the browser for one pass through the funnel. Not a
  -- user id, not a device id, not stable across visits.
  visit_id TEXT NOT NULL,
  -- Which screen was reached: 'landed', 'q_goal', …, 'reveal', 'checkout'.
  step TEXT NOT NULL,
  -- utm_source / medium / campaign / content, and the click id when there was
  -- one. Whatever the ad platform put in the URL, nothing more.
  attribution JSONB,
  locale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keeps the text columns from being used as a general-purpose sink by anybody
-- who finds the endpoint: a step name is a short identifier, not a payload.
ALTER TABLE funnel_events DROP CONSTRAINT IF EXISTS funnel_events_step_shape;
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_step_shape
  CHECK (step ~ '^[a-z0-9_]{1,40}$');

ALTER TABLE funnel_events DROP CONSTRAINT IF EXISTS funnel_events_visit_shape;
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_visit_shape
  CHECK (visit_id ~ '^[A-Za-z0-9_-]{8,64}$');

-- One row per visit per step. A visitor who taps back and forth between two
-- questions should not read as ten people: the funnel is counted in distinct
-- visits reaching a step, so the second insert for the same pair is dropped.
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_visit_step
  ON funnel_events (visit_id, step);

CREATE INDEX IF NOT EXISTS idx_funnel_events_step_day
  ON funnel_events (step, created_at DESC);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- Write-only from the outside world. There is no SELECT policy on purpose:
-- with RLS on and none granted, no anon or authenticated session can read any
-- row, its own included. The admin panel reads these through the service role.
DROP POLICY IF EXISTS funnel_events_insert ON funnel_events;
CREATE POLICY funnel_events_insert ON funnel_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

REVOKE ALL ON funnel_events FROM anon, authenticated;
GRANT INSERT ON funnel_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE funnel_events_id_seq TO anon, authenticated;

COMMENT ON TABLE funnel_events IS
  'Anonymous drop-off tracking for /start. No identity, no IP. Insert-only for anon and authenticated; readable only via the service role.';

COMMIT;
