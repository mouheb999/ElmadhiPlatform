-- 023_drop_template_system.sql
-- Removes the template-copy engine replaced by the slot-filling generator
-- (src/lib/algorithms/split-fill.ts).
--
-- The old model stored pre-built programs as concrete exercise rows:
--   program_templates -> template_days -> template_exercises
-- and generation cloned them into user_program_*. Generation now reads the
-- abstract slot definitions in split_definitions -> split_days ->
-- split_day_slots and picks exercises at run time, so these three tables have
-- no reader left. Migration 019 already emptied them (0 rows).
--
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- user_programs.source_template_id is the last FK into program_templates.
-- It recorded which template a program was cloned from; nothing clones now.
ALTER TABLE user_programs DROP COLUMN IF EXISTS source_template_id;

-- Child-first: template_exercises -> template_days -> program_templates.
-- (template_days/template_exercises cascade from their parents anyway, but
-- dropping explicitly keeps the intent readable.)
DROP TABLE IF EXISTS template_exercises;
DROP TABLE IF EXISTS template_days;
DROP TABLE IF EXISTS program_templates;

COMMIT;

-- ============================================================
-- ROLLBACK (pre-commit: run ROLLBACK; instead of COMMIT;)
-- Post-commit, recreate from 004_workout_tables.sql:
-- ============================================================
-- BEGIN;
--   CREATE TABLE program_templates (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name TEXT NOT NULL,
--     split_type TEXT NOT NULL,
--     days_per_week INTEGER NOT NULL,
--     goal TEXT NOT NULL,
--     experience TEXT NOT NULL,
--     equipment_required TEXT NOT NULL,
--     description TEXT,
--     rationale_template JSONB,
--     created_at TIMESTAMPTZ DEFAULT NOW()
--   );
--   CREATE TABLE template_days (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
--     day_number INTEGER NOT NULL,
--     day_name TEXT NOT NULL,
--     UNIQUE(template_id, day_number)
--   );
--   CREATE TABLE template_exercises (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     template_day_id UUID NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
--     exercise_id UUID NOT NULL REFERENCES exercises(id),
--     order_index INTEGER NOT NULL,
--     sets INTEGER NOT NULL DEFAULT 3,
--     rep_range TEXT NOT NULL DEFAULT '8-12',
--     rest_seconds INTEGER DEFAULT 90,
--     notes TEXT
--   );
--   ALTER TABLE user_programs
--     ADD COLUMN source_template_id UUID REFERENCES program_templates(id);
--   -- RLS policies for the three tables live in 008_rls_policies.sql.
-- COMMIT;
