-- 039_profile_phone.sql
-- A contact number on every account.
--
-- Until now nothing in the product asked for one: `profiles` had no such
-- column and `auth.users.phone` is empty for all 308 accounts, because both
-- sign-up paths (email/password and Google) only ever yield an email. That
-- left no way to reach a user who stalls before paying — the single most
-- valuable moment to reach them.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Stored E.164 ('+216XXXXXXXX'). Normalisation happens in the app before the
-- write (see lib/phone.ts); this is the backstop against anything else.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');

-- The user owns this field, exactly like full_name and locale. Migration 013
-- revoked blanket UPDATE and re-granted a column whitelist; re-state the whole
-- list here, since a column not named is a column not writable.
GRANT UPDATE (full_name, locale, phone, updated_at) ON profiles TO authenticated;

-- Carry a number supplied during email sign-up through to the profile row.
-- Google users have no metadata to carry, so they are asked after the fact —
-- see the /phone gate in proxy.ts.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Finding an account from a WhatsApp message is the whole point.
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone) WHERE phone IS NOT NULL;
