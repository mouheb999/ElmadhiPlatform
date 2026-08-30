-- 038_qa_cards_random.sql
-- Pick the dashboard's Q&A spark cards in the database instead of in Node.
--
-- The Today screen showed five random cards, and got them by selecting every
-- published row with four text columns each and shuffling the result in JS. On
-- ~150 seeded cards that is already most of a library moved across the wire on
-- the busiest render in the app, and it grows with every card the content pass
-- adds — the one query in that screen whose cost is unbounded by design.
--
-- ORDER BY random() is a scan and a sort, which on a table of this size is
-- nothing next to serialising it, and it keeps every card reachable rather than
-- restricting the spark to some arbitrary first N.
--
-- SECURITY INVOKER (the default) on purpose: qa_cards has RLS, so the caller's
-- own policy still applies and this cannot become a way to read unpublished
-- drafts. The is_published filter below is belt-and-braces for the same reason.
--
-- Re-runnable.

CREATE OR REPLACE FUNCTION qa_cards_random(n INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  question_en TEXT,
  question_ar TEXT,
  answer_short TEXT,
  answer_short_ar TEXT
)
LANGUAGE sql
-- Pinned for the same reason migration 047 pins every other function's: a
-- fixed path with no exceptions is a rule you can check, and "this one is
-- SECURITY INVOKER so it doesn't matter" is a reason you have to re-derive.
SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.question_en, c.question_ar, c.answer_short, c.answer_short_ar
  FROM qa_cards c
  WHERE c.is_published = TRUE
  ORDER BY random()
  -- Clamped so the argument can never turn this back into "select everything".
  LIMIT LEAST(GREATEST(COALESCE(n, 5), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION qa_cards_random(INTEGER) TO authenticated;
