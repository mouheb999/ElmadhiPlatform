-- 002_profiles.sql
-- Identity / access. One row per auth user.

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  has_paid BOOLEAN DEFAULT FALSE,
  -- UI language preference. Not in architecture.md: added for the user's
  -- "English + Tunisian Arabic, switchable in settings" requirement. No French.
  locale TEXT DEFAULT 'tn' CHECK (locale IN ('en', 'tn')),
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  plan_expires_at TIMESTAMPTZ,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
