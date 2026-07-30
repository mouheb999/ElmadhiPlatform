-- 032 — fold the `mindset` Q&A category into `supplements`.
--
-- `mindset` came from the original 4-category seed. The visual card set added
-- in 031 has no separate mindset category — it ships "Supplements & mindset"
-- as one bucket — so `mindset` was left holding nothing but two legacy cards
-- and an empty filter chip in the library.
--
-- Move its cards over, then drop it. No content is lost.

UPDATE qa_cards
SET category_id = (SELECT id FROM qa_categories WHERE slug = 'supplements')
WHERE category_id = (SELECT id FROM qa_categories WHERE slug = 'mindset');

DELETE FROM qa_categories WHERE slug = 'mindset';
