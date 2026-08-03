-- 040_profile_contacted.sql
-- Remember who has already been chased on WhatsApp.
--
-- With hundreds of unpaid accounts and one person working the list, the thing
-- that actually slows the job down is not knowing where you stopped. Two admins
-- messaging the same customer looks careless; skipping one loses a sale.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contacted_by UUID REFERENCES profiles(id);

-- Deliberately NOT added to the `authenticated` column whitelist from
-- migration 013: this is an admin's note about a customer, not something the
-- customer may edit. Every write goes through the service-role client after a
-- server-side is_admin check.

-- The list is sorted with the never-contacted first, so this is the shape the
-- page actually queries on.
CREATE INDEX IF NOT EXISTS idx_profiles_contacted_at
  ON profiles(contacted_at NULLS FIRST);
