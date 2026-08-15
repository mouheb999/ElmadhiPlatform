-- 042_copy_overrides.sql
-- Editable UI copy: one row per string the admin has changed.
--
-- src/lib/i18n.ts stays the source of truth for what strings exist and what
-- they say by default. This table only holds the deltas, so a key that has
-- never been edited costs nothing, shipping new copy in code still works, and
-- deleting a row is how you revert to the default rather than a second edit.
--
-- Re-runnable.

CREATE TABLE IF NOT EXISTS copy_overrides (
  -- A StringKey from i18n.ts. Not a foreign key to anything — the catalogue
  -- lives in code — so the publish action validates membership before writing.
  key TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'tn')),
  value TEXT NOT NULL CHECK (char_length(value) <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  PRIMARY KEY (key, locale)
);

ALTER TABLE copy_overrides ENABLE ROW LEVEL SECURITY;

-- Readable by everyone, signed in or not: the landing page, the login screen
-- and the checkout flow all render copy before there is a session to check.
-- Nothing here is user data — it is the product's own words.
DROP POLICY IF EXISTS copy_overrides_read ON copy_overrides;
CREATE POLICY copy_overrides_read ON copy_overrides
  FOR SELECT USING (TRUE);

-- No write policies on purpose. Publishing goes through a Server Function that
-- checks requireAdmin and then writes with the service-role client, matching
-- how every other admin write in this project works. Without this, the `key`
-- column would be an open door: a user who could INSERT arbitrary rows could
-- rewrite any sentence in the product, including the payment instructions.
