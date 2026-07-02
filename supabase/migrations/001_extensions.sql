-- 001_extensions.sql
-- Required Postgres extensions.

-- Trigram search for fuzzy food/recipe name matching.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- gen_random_uuid() + crypto helpers. (Built-in on PG13+, but kept explicit.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
