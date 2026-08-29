-- 048_payment_methods_ui.sql
-- Make the payment picker something you can read in three seconds.
--
-- THE PROBLEM
--
-- `payment_methods` carries one text field per language, and every row has
-- 380–715 characters in it: an eight-step numbered walkthrough of somebody
-- else's app. The checkout screen renders that inline the moment a method is
-- chosen, so picking D17 drops a wall of text between the customer and the
-- button. The method list itself is four identical rows of text with a radio
-- circle, which is the least legible way to present a choice everybody makes
-- by recognising a logo.
--
-- THE SHAPE
--
--   hint_*    one line. What the customer needs to know that the account
--             number does not already tell them.
--   logo_url  a real brand logo when there is one. The app draws a monogram
--             tile from `key` until this is filled in, so the picker looks
--             finished either way and nothing has to ship broken.
--
-- `instructions_*` is left in place and left populated. It is no longer
-- rendered, but it is the only copy of the full walkthrough, and deleting it
-- to celebrate a redesign would be throwing away the answer to every "how do I
-- actually do this" the support inbox is about to receive.
--
-- Re-runnable.

BEGIN;

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS hint_en TEXT,
  ADD COLUMN IF NOT EXISTS hint_ar TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN payment_methods.hint_en IS
  'One short line shown under the account number. Not a walkthrough.';
COMMENT ON COLUMN payment_methods.logo_url IS
  'Brand logo. NULL falls back to a monogram tile drawn from `key`.';

-- ---------------------------------------------------------------------------
-- The one line each existing method needs
-- ---------------------------------------------------------------------------
-- Written to answer the only question the number itself leaves open, and
-- nothing else. The fee line matters: the old instructions told people to add
-- 1% themselves, so the amount that arrived never matched the amount on the
-- request, which is a rejection waiting to happen.

UPDATE payment_methods SET
  hint_ar = 'ابعث المبلغ اللي فوق بالضبط — معلوم التحويل علينا.',
  hint_en = 'Send exactly the amount above — the transfer fee is on us.'
WHERE key IN ('d17', 'flouci');

UPDATE payment_methods SET
  hint_ar = 'زيد اسمك في خانة الوصف باش نعرفوك.',
  hint_en = 'Put your name in the description so we can match it to you.'
WHERE key = 'bank';

UPDATE payment_methods SET
  hint_ar = 'شبكة Solana برك. شبكة أخرى = فلوسك تضيع.',
  hint_en = 'Solana network only. Another network loses the funds for good.'
WHERE key = 'crypto';

-- ---------------------------------------------------------------------------
-- Two new methods
-- ---------------------------------------------------------------------------
-- Disabled on arrival, deliberately. Both need a real recipient name and the
-- exact details a counter clerk will ask for, and those are the owner's to
-- fill in — an enabled method with a placeholder in it takes somebody's money
-- to nowhere. Fill in `account_value` in /admin, then switch them on.

INSERT INTO payment_methods (key, is_enabled, order_index, label_en, label_ar, account_value, hint_en, hint_ar)
VALUES
  ('western_union', FALSE, 5, 'Western Union', 'ويسترن يونيون', NULL,
   'Send to the name above, then send us the MTCN with your receipt.',
   'ابعث للاسم اللي فوق، وبعدها ابعثلنا رقم MTCN مع الوصل.'),
  ('wafacash', FALSE, 6, 'Wafacash', 'وفا كاش', NULL,
   'Send to the name above, then send us the transfer code with your receipt.',
   'ابعث للاسم اللي فوق، وبعدها ابعثلنا كود التحويل مع الوصل.')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Refuse to commit unless it took
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_hints INT;
  new_methods INT;
BEGIN
  SELECT count(*) INTO missing_hints
  FROM payment_methods
  WHERE is_enabled AND (hint_ar IS NULL OR hint_en IS NULL);
  IF missing_hints > 0 THEN
    RAISE EXCEPTION '% enabled method(s) have no one-line hint — rolling back', missing_hints;
  END IF;

  SELECT count(*) INTO new_methods
  FROM payment_methods WHERE key IN ('western_union', 'wafacash');
  IF new_methods <> 2 THEN
    RAISE EXCEPTION 'expected Western Union and Wafacash, found % — rolling back', new_methods;
  END IF;

  RAISE NOTICE 'OK: hints in place, two new methods added (disabled until their details are filled in).';
END $$;

COMMIT;
