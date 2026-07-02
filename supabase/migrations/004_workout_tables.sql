-- 004_workout_tables.sql
-- Workout Maker domain tables. Indexes live in 006.

CREATE TABLE training_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 6),
  session_minutes INTEGER DEFAULT 60,
  equipment TEXT NOT NULL CHECK (equipment IN ('full_gym', 'home_basic', 'home_advanced', 'bodyweight')),
  experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  injuries TEXT[],
  goal TEXT NOT NULL CHECK (goal IN ('lose_fat', 'build_muscle', 'get_stronger', 'general_fitness')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  name_fr TEXT,
  primary_muscle TEXT NOT NULL CHECK (primary_muscle IN ('chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'core', 'forearms')),
  secondary_muscles TEXT[],
  equipment TEXT NOT NULL CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band')),
  movement_pattern TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  contraindicated_for TEXT[],
  video_url TEXT,
  thumbnail_url TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  split_type TEXT NOT NULL,
  days_per_week INTEGER NOT NULL,
  goal TEXT NOT NULL,
  experience TEXT NOT NULL,
  equipment_required TEXT NOT NULL,
  description TEXT,
  rationale_template JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_name TEXT NOT NULL,
  UNIQUE(template_id, day_number)
);

CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  rep_range TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER DEFAULT 90,
  notes TEXT
);

-- User's active program (snapshot of a template, fully editable).
CREATE TABLE user_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  training_profile_id UUID NOT NULL REFERENCES training_profiles(id),
  source_template_id UUID REFERENCES program_templates(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  name TEXT NOT NULL,
  split_type TEXT NOT NULL,
  user_modified BOOLEAN DEFAULT FALSE,
  warnings_acknowledged JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_id UUID NOT NULL REFERENCES user_programs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_name TEXT NOT NULL,
  UNIQUE(user_program_id, day_number)
);

CREATE TABLE user_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_day_id UUID NOT NULL REFERENCES user_program_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  rep_range TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER DEFAULT 90,
  is_user_modified BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Workout logging (schema ready; no UI in MVP).
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_program_day_id UUID REFERENCES user_program_days(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  weight_kg NUMERIC(5,1),
  reps INTEGER NOT NULL,
  rpe NUMERIC(3,1),
  is_warmup BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
