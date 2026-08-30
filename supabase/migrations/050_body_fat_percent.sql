-- 050_body_fat_percent.sql
-- One column, for the one body-fat input the simplified calculator reads.
--
-- The quiz used to ask for a body-fat CATEGORY (very_lean / normal /
-- a_little_fat / high) and interpolate the calorie deficit, the protein g/kg
-- and the fat % against it. The HYPE simplified calculator drops that: a
-- self-reported body type "peut rester dans le quiz pour l'expérience
-- utilisateur, mais il ne doit pas être utilisé comme donnée principale pour
-- calculer les calories." Goal factors and protein are flat now.
--
-- What a MEASURED percentage does change is the metabolic rate itself:
--
--   LBM = weight × (1 − body_fat% / 100)
--   RMR = 500 + 22 × LBM
--
-- which reads lean mass directly instead of using height and age as proxies
-- for it. So the category question is replaced by an optional numeric one, and
-- this is where the answer lands.
--
-- `body_fat_level` and `daily_steps` are NOT dropped. They hold real answers
-- from every profile built before today and are read back on those rows;
-- nothing writes them from here on.
--
-- No backfill: a percentage cannot be recovered from a category, and inventing
-- one would silently change the resting-energy formula for every existing
-- profile. Existing rows keep NULL and keep Mifflin-St Jeor, which is exactly
-- what they were computed with.
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

ALTER TABLE diet_profiles
  ADD COLUMN IF NOT EXISTS body_fat_percent NUMERIC(4,1)
    CHECK (body_fat_percent IS NULL OR (body_fat_percent >= 3 AND body_fat_percent <= 60));

COMMENT ON COLUMN diet_profiles.body_fat_percent IS
  'Measured body fat %, optional. When present, resting energy is 500 + 22 x lean mass instead of Mifflin-St Jeor. NULL means the user did not know it - not that it is zero.';

COMMENT ON COLUMN diet_profiles.body_fat_level IS
  'RETIRED by migration 050. Self-reported body-fat category from the old quiz. Kept for the rows that carry it; never written anymore.';

COMMENT ON COLUMN diet_profiles.daily_steps IS
  'RETIRED by migration 050. Daily-step band from the old quiz, which added a flat kcal bonus on top of the activity factor. The simplified calculator deliberately excludes step count. Kept for the rows that carry it; never written anymore.';

COMMIT;
