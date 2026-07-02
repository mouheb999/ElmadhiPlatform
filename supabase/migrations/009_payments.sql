-- 009_payments.sql
-- Manual, WhatsApp-verified payment flow for the Tunisian market.
-- No automated gateway: users pick a method (D17 / Flouci / Crypto / Bank),
-- follow the on-screen guide, then confirm via WhatsApp. An in-app admin
-- reviews the screenshot and activates the account.

-- ---------- profiles: admin flag + payment status ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'pending', 'active'));

-- ---------- Singleton store-wide payment settings (admin-editable) ----------
CREATE TABLE payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  price_tnd NUMERIC(8,2) NOT NULL DEFAULT 89,
  -- optional strike-through "regular price" for the FOMO offer
  compare_at_tnd NUMERIC(8,2),
  offer_label_en TEXT DEFAULT 'Limited-time offer',
  offer_label_ar TEXT DEFAULT 'عرض لفترة محدودة',
  whatsapp_number TEXT,                 -- e.g. +21612345678 (digits + leading +)
  -- prefilled WhatsApp message templates. Placeholders: {email} {method} {amount}
  whatsapp_message_en TEXT DEFAULT
    'Hi, I want to activate my ELMADHI account.%0AEmail: {email}%0AMethod: {method}%0AAmount: {amount} DT',
  whatsapp_message_ar TEXT DEFAULT
    'السلام، نحب نفعّل حسابي في ELMADHI.%0Aالإيميل: {email}%0Aالطريقة: {method}%0Aالمبلغ: {amount} دينار',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- Payment methods (admin-editable, bilingual) ----------
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,             -- 'd17' | 'flouci' | 'crypto' | 'bank'
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  -- the copyable value the user pays to: phone / RIB / wallet address
  account_value TEXT,
  -- markdown how-to guide per language
  instructions_en TEXT,
  instructions_ar TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO payment_methods (key, order_index, label_en, label_ar) VALUES
  ('d17',    1, 'D17',                 'D17'),
  ('flouci', 2, 'Flouci',             'Flouci'),
  ('crypto', 3, 'Crypto (Binance)',   'العملات المشفّرة (Binance)'),
  ('bank',   4, 'Bank transfer',      'تحويل بنكي');

-- ---------- Payment requests (one per "I've paid" click) ----------
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method_key TEXT NOT NULL,
  amount_tnd NUMERIC(8,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_payment_requests_user ON payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status, created_at DESC);

-- ---------- RLS ----------
-- Settings + enabled methods are public-read (shown on the checkout page).
-- All admin writes go through the service-role client (bypasses RLS) after a
-- server-side is_admin check, so no admin write policies are needed here.
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_settings_public_read" ON payment_settings
  FOR SELECT USING (TRUE);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_methods_public_read" ON payment_methods
  FOR SELECT USING (is_enabled = TRUE);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_payment_requests_insert" ON payment_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_payment_requests_select" ON payment_requests
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- Make the founder an admin (no-op if not signed up yet) ----------
-- Re-runnable: flags any of the founder's known emails. Add more here as needed.
UPDATE profiles SET is_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('mou.heb142003@gmail.com', 'boubrikmouheb@gmail.com')
);
