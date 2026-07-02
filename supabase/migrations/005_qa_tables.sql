-- 005_qa_tables.sql
-- Q&A Library tables.
--
-- Deviation from architecture.md: the original schema only had `_fr` + `_ar`
-- columns and a single-language answer. The user requires UI in English +
-- Tunisian Arabic with NO French. So here:
--   * `name_fr` / `question_fr` are kept (for compatibility) but made NULLABLE,
--   * `name_en` / `question_en` are added,
--   * `_ar` columns hold Tunisian Arabic.
-- The answer columns (`answer_short`, `answer_long_md`) stay single-column and
-- hold English for now; Tunisian-Arabic answer variants are deferred to Phase 7.
-- TODO(mouheb): decide final bilingual storage for Q&A answers in Phase 7.

CREATE TABLE qa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  name_ar TEXT,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE qa_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES qa_categories(id),
  question_fr TEXT,
  question_en TEXT,
  question_ar TEXT,
  answer_short TEXT NOT NULL,
  answer_long_md TEXT,
  answer_short_ar TEXT,
  answer_long_md_ar TEXT,
  visual_type TEXT,
  visual_data JSONB,
  scientific_sources JSONB,
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
