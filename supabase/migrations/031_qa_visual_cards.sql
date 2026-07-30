-- 031 — Q&A: visual answer cards + a monthly ask quota.
--
-- Two changes, one section each.
--
-- A. The Q&A library was a question + one short answer + optional markdown.
--    The new content set (150 Tunisian-Arabic cards, `elmadhi_visual_faq_cards_v1`)
--    answers in six named blocks instead of one paragraph: quick answer, why,
--    what to do, common mistake, coach tip, and an optional safety warning.
--    Those blocks get real columns rather than living inside `visual_data`,
--    because the reader renders each one as its own labelled section and the
--    admin editor has to be able to edit them field by field.
--
--    The content is Tunisian Arabic only, so it lands in the `_ar` columns and
--    the English ones stay NULL — pick() in src/lib/i18n.ts already falls back
--    to whichever side is present. That means `answer_short` (English) can no
--    longer be NOT NULL.
--
-- B. Users may ask a limited number of questions per calendar month (3 by
--    default). The limit lives in a singleton settings row so an admin can
--    change it without a deploy, and a trigger enforces it in the database —
--    the server action checks it too, but the action is only a friendly
--    message; this is the thing that actually holds.

-- =====================================================================
-- A. Visual answer cards
-- ---------------------------------------------------------------------

ALTER TABLE qa_categories
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

ALTER TABLE qa_cards
  -- stable id from the content file (faq_001 …) so re-seeding upserts
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS science_explanation TEXT,
  ADD COLUMN IF NOT EXISTS science_explanation_ar TEXT,
  ADD COLUMN IF NOT EXISTS practical_application TEXT,
  ADD COLUMN IF NOT EXISTS practical_application_ar TEXT,
  ADD COLUMN IF NOT EXISTS common_mistake TEXT,
  ADD COLUMN IF NOT EXISTS common_mistake_ar TEXT,
  ADD COLUMN IF NOT EXISTS coach_tip TEXT,
  ADD COLUMN IF NOT EXISTS coach_tip_ar TEXT,
  -- safety note; only ~20 of the 150 cards carry one
  ADD COLUMN IF NOT EXISTS warning TEXT,
  ADD COLUMN IF NOT EXISTS warning_ar TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT
    CHECK (difficulty_level IS NULL OR difficulty_level IN ('Beginner', 'Intermediate', 'Advanced', 'Safety')),
  ADD COLUMN IF NOT EXISTS estimated_read_time TEXT,
  -- per-card overrides; when NULL the card inherits its category's look
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

ALTER TABLE qa_cards ALTER COLUMN answer_short DROP NOT NULL;

-- Plain (not partial) unique index: NULLs stay distinct in Postgres, so cards
-- created by admin triage are unaffected, and ON CONFLICT (external_id) — what
-- the seed script upserts on — can only use a non-partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_cards_external_id ON qa_cards(external_id);

COMMENT ON COLUMN qa_cards.external_id IS
  'Stable id from supabase/seed/qa_visual_faq_cards_v1.json (faq_001…). The seed script upserts on it; NULL for cards created by admin triage.';

-- The six categories of the visual card set. `recovery` and `supplements`
-- already exist and keep their slugs — the review page maps focus areas onto
-- them (src/app/(app)/review/page.tsx) — only their labels widen.
INSERT INTO qa_categories (slug, name_en, name_ar, order_index, icon, accent_color) VALUES
  ('nutrition',       'Nutrition',           'التغذية',           1, 'fork_knife',    '#22C55E'),
  ('training',        'Training',            'التمرين',           2, 'dumbbell',      '#38BDF8'),
  ('running_walking', 'Running & walking',   'الجري والمشي',      3, 'running',       '#F59E0B'),
  ('recovery',        'Recovery & injuries', 'الراحة والإصابات',  4, 'moon',          '#A78BFA'),
  ('women_cycle',     'Women & cycle',       'المرأة والدورة',    5, 'cycle',         '#F472B6'),
  ('supplements',     'Supplements & mindset', 'المكملات والعقلية', 6, 'brain_capsule', '#10B981')
ON CONFLICT (slug) DO UPDATE SET
  name_en      = EXCLUDED.name_en,
  name_ar      = EXCLUDED.name_ar,
  order_index  = EXCLUDED.order_index,
  icon         = EXCLUDED.icon,
  accent_color = EXCLUDED.accent_color;

-- `mindset` predates this set, which folds mindset into `supplements`. Its
-- cards stay published; the category just sorts after the six above.
UPDATE qa_categories SET order_index = 7 WHERE slug = 'mindset';

-- The 15 cards written before this content set share the 1-150 numbering the
-- seed uses, so they would interleave with it. Move them behind it — they stay
-- published and searchable, and they carry the only English answers we have.
UPDATE qa_cards SET order_index = COALESCE(order_index, 0) + 1000
  WHERE external_id IS NULL AND COALESCE(order_index, 0) < 1000;

-- =====================================================================
-- B. Monthly ask quota
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qa_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_question_limit INTEGER NOT NULL DEFAULT 3 CHECK (monthly_question_limit >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO qa_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE qa_settings ENABLE ROW LEVEL SECURITY;
-- Everyone may read the limit (the ask box shows "2 of 3 left"); only the
-- service role writes it, so no INSERT/UPDATE policy is granted.
DROP POLICY IF EXISTS "qa_settings_public_read" ON qa_settings;
CREATE POLICY "qa_settings_public_read" ON qa_settings FOR SELECT USING (TRUE);

-- Counting is per calendar month in UTC and counts every submission, including
-- ones an admin later dismissed: the quota is on asking, not on being answered.
CREATE OR REPLACE FUNCTION enforce_qa_request_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  SELECT monthly_question_limit INTO v_limit FROM qa_settings WHERE id = 1;
  IF v_limit IS NULL THEN
    v_limit := 3;
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM qa_requests
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('month', NOW());

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'qa_monthly_quota_exceeded: % of % questions already used this month', v_used, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_request_quota ON qa_requests;
CREATE TRIGGER trg_qa_request_quota
  BEFORE INSERT ON qa_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_qa_request_quota();

-- The admin panel lists usage for the current month; the user's own ask box
-- counts the same rows through RLS.
CREATE INDEX IF NOT EXISTS idx_qa_requests_user_created
  ON qa_requests(user_id, created_at DESC);
