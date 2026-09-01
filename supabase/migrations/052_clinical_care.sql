-- 052_clinical_care.sql
-- The care layer: training around dialysis, insulin and blood pressure.
--
-- Everything in this file exists to serve ONE RULE:
--
--     Hype does not make clinical decisions. It records the ones clinicians
--     have already made, and refuses to move until it has them.
--
-- That rule is why almost every gate below is a three-state column whose
-- DEFAULT is 'unknown', and why 'unknown' is read by the app as the most
-- restrictive answer rather than the most convenient one. A missing
-- orthopedist line does not mean "probably fine to squat" — it means lower
-- body is closed. A missing blood-pressure clearance does not mean "train to
-- feel" — it means seated, minimum intensity. There is no column anywhere here
-- that lets the product invent a number a doctor is supposed to supply.
--
-- The four external authorities this schema defers to, and the column that
-- holds each one's answer:
--
--   Nephrology / dialysis unit  -> dialysis_days, vascular_access, and the
--                                  fluid allowance on the renal plan.
--   Orthopedist                 -> weight_bearing. Gates every loaded leg
--                                  movement in the product.
--   Cardiologist / GP           -> bp_clearance + the skip-above thresholds.
--                                  Caps intensity. Not "how he feels today".
--   Diabetologist               -> glucose_floor/ceiling. Decides whether a
--                                  session happens at all.
--
-- And the one thing that is deliberately NOT designed here: the food. A renal
-- diet is the dietitian's document. `renal_diet_plans` stores it and the app
-- displays it; there is no generator, no macro solver, and no path from
-- `macro_targets` into any of this. Hype's job on nutrition is portions,
-- fluid, and whether he stuck to it — three tables of logging against somebody
-- else's numbers.
--
-- Re-runnable. Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. clinical_profiles — the medical facts the program bends around
-- ============================================================
-- Versioned and is_active-flagged like training_profiles and diet_profiles,
-- for the same reason those are: a clearance is dated. When the orthopedist
-- upgrades him from "none" to "partial", the old row is the record of what the
-- program was allowed to do last month, and the sessions logged under it stay
-- explainable. Superseding writes a new version; nothing here is UPDATEd in
-- place except the notes.
CREATE TABLE IF NOT EXISTS clinical_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL DEFAULT 1,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,

  -- Which of the care rules apply at all. A user with only 'hypertension' gets
  -- the intensity cap and none of the dialysis day-typing; the app reads this
  -- array before it reads anything else in the row.
  conditions TEXT[] NOT NULL DEFAULT '{}',

  -- ---- Dialysis: the week's shape ----
  -- ISO weekday numbers, 1 = Monday … 7 = Sunday. Not a start date plus an
  -- interval: a unit gives you "Monday, Wednesday, Saturday", and a schedule
  -- that drifts by arithmetic would put a training day on a session day the
  -- first time a holiday moved one.
  dialysis_days             SMALLINT[] NOT NULL DEFAULT '{}',
  dialysis_start_time       TIME,
  dialysis_duration_minutes INTEGER,

  -- The two windows either side of a session where training is off. Columns,
  -- not constants, because "washed out for hours after" is a number that comes
  -- from HIS reported energy pattern and gets tuned — that is the coach
  -- decision, and it should be visible and editable rather than buried in a
  -- TypeScript file.
  post_session_recovery_hours INTEGER NOT NULL DEFAULT 24,
  pre_session_buffer_hours    INTEGER NOT NULL DEFAULT 4,

  -- The access limb. Everything about it is a restriction the unit states, not
  -- one the app infers: no load through that arm, no cuff on it, no lying on
  -- it. Stored as side-and-kind together because the restriction differs — a
  -- neck catheter restricts nothing about an arm.
  vascular_access TEXT NOT NULL DEFAULT 'unknown',

  -- ---- Orthopedist: the lower-body gate ----
  -- The single line the whole leg half of the program waits on. 'unknown' is
  -- not a soft state: until this says partial or full, the generator and the
  -- session screen both treat every loaded leg movement as unavailable.
  weight_bearing            TEXT NOT NULL DEFAULT 'unknown',
  weight_bearing_source     TEXT,
  weight_bearing_dated_on   DATE,

  -- ---- Blood pressure: the intensity cap ----
  -- "Intensity is capped by his blood pressure clearance, not by how he feels
  -- that day." The clearance is the cap; the two thresholds are the day-of
  -- skip rule the same clinician sets.
  bp_clearance         TEXT NOT NULL DEFAULT 'unknown',
  bp_skip_above_systolic   INTEGER,
  bp_skip_above_diastolic  INTEGER,
  bp_cleared_by        TEXT,
  bp_cleared_on        DATE,

  -- ---- Diabetologist: the glucose window ----
  -- Below the floor or above the ceiling, the session does not happen. Stored
  -- in mg/dL as the one canonical unit so comparisons never straddle two
  -- scales; `glucose_display_unit` is what his meter and his doctor's note
  -- actually say. In Tunisia that is usually g/L (1.20 g/L = 120 mg/dL), which
  -- is exactly why this is a display concern and not a storage one.
  glucose_floor_mgdl   INTEGER,
  glucose_ceiling_mgdl INTEGER,
  glucose_display_unit TEXT NOT NULL DEFAULT 'g_l',
  glucose_set_by       TEXT,
  glucose_set_on       DATE,

  -- ---- Session shape ----
  -- Short and frequent. These are the caps the session screen enforces and the
  -- builder respects; the hard stop is a rule, not a target, so there is no
  -- "sets to failure" anywhere in this schema.
  session_min_minutes  INTEGER NOT NULL DEFAULT 15,
  session_max_minutes  INTEGER NOT NULL DEFAULT 25,
  rest_seconds_min     INTEGER NOT NULL DEFAULT 120,
  effort_ceiling       INTEGER NOT NULL DEFAULT 4,   -- of 10. Hard stop above.
  seated_or_supported_only BOOLEAN NOT NULL DEFAULT TRUE,

  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The vocabularies. Written as DROP-then-ADD so re-running the file over an
-- existing table re-asserts them rather than erroring.
ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_conditions_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_conditions_check
  CHECK (conditions <@ ARRAY['dialysis','diabetes_insulin','diabetes_oral','hypertension']::TEXT[]);

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_dialysis_days_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_dialysis_days_check
  CHECK (dialysis_days <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]);

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_access_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_access_check
  CHECK (vascular_access IN ('unknown','none','fistula_left','fistula_right',
                             'graft_left','graft_right','catheter'));

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_weight_bearing_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_weight_bearing_check
  CHECK (weight_bearing IN ('unknown','none','partial','full'));

-- 'light_only' and 'moderate' are the two cleared states. There is no
-- 'unrestricted': a dialysis patient with hypertension does not get one from
-- this product.
ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_bp_clearance_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_bp_clearance_check
  CHECK (bp_clearance IN ('unknown','not_cleared','light_only','moderate'));

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_glucose_unit_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_glucose_unit_check
  CHECK (glucose_display_unit IN ('g_l','mg_dl','mmol_l'));

-- A window that is not a window is worse than no window: it would silently
-- refuse every session, or silently allow one at 40 mg/dL. Both bounds or
-- neither, and the floor below the ceiling.
ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_glucose_window_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_glucose_window_check
  CHECK (
    (glucose_floor_mgdl IS NULL) = (glucose_ceiling_mgdl IS NULL)
    AND (glucose_floor_mgdl IS NULL OR (
      glucose_floor_mgdl BETWEEN 40 AND 400
      AND glucose_ceiling_mgdl BETWEEN 40 AND 600
      AND glucose_floor_mgdl < glucose_ceiling_mgdl
    ))
  );

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_bp_thresholds_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_bp_thresholds_check
  CHECK (
    (bp_skip_above_systolic IS NULL OR bp_skip_above_systolic BETWEEN 100 AND 250)
    AND (bp_skip_above_diastolic IS NULL OR bp_skip_above_diastolic BETWEEN 50 AND 150)
  );

ALTER TABLE clinical_profiles DROP CONSTRAINT IF EXISTS clinical_profiles_session_shape_check;
ALTER TABLE clinical_profiles ADD CONSTRAINT clinical_profiles_session_shape_check
  CHECK (
    session_min_minutes BETWEEN 5 AND 60
    AND session_max_minutes BETWEEN session_min_minutes AND 60
    AND rest_seconds_min BETWEEN 30 AND 600
    AND effort_ceiling BETWEEN 1 AND 10
    AND post_session_recovery_hours BETWEEN 0 AND 48
    AND pre_session_buffer_hours BETWEEN 0 AND 24
    AND (dialysis_duration_minutes IS NULL OR dialysis_duration_minutes BETWEEN 30 AND 600)
  );

-- One active clinical profile per user, enforced rather than assumed: two
-- active rows would mean two different answers to "may he load his legs".
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_profiles_active
  ON clinical_profiles(user_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_clinical_profiles_user
  ON clinical_profiles(user_id, version DESC);

-- ============================================================
-- 2. clinical_readings — the numbers taken either side of a session
-- ============================================================
-- Glucose and blood pressure in one table because they are taken at the same
-- three moments and read together: before a session they are the two gates,
-- after it they are the record of what the session did. Splitting them would
-- mean two queries and two inserts for one screen that always shows both.
--
-- `outcome` is stored, not derived on read. The window it was judged against
-- lives on a clinical_profile that may be superseded next month; a reading
-- that blocked a session in September must still read as blocked in December.
CREATE TABLE IF NOT EXISTS clinical_readings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Nullable: a reading taken on a dialysis morning belongs to no session, and
  -- refusing to record it would be refusing the most informative ones.
  session_id  UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  timing      TEXT NOT NULL,
  taken_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  glucose_mgdl INTEGER,
  systolic     INTEGER,
  diastolic    INTEGER,
  pulse_bpm    INTEGER,

  outcome      TEXT NOT NULL DEFAULT 'unjudged',
  -- "Ate 15 g fast carbs and re-tested." The protocol's fourth step, and the
  -- only part of it a database can hold.
  action_taken TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clinical_readings DROP CONSTRAINT IF EXISTS clinical_readings_kind_check;
ALTER TABLE clinical_readings ADD CONSTRAINT clinical_readings_kind_check
  CHECK (kind IN ('glucose','blood_pressure'));

ALTER TABLE clinical_readings DROP CONSTRAINT IF EXISTS clinical_readings_timing_check;
ALTER TABLE clinical_readings ADD CONSTRAINT clinical_readings_timing_check
  CHECK (timing IN ('pre_session','post_session','spot'));

ALTER TABLE clinical_readings DROP CONSTRAINT IF EXISTS clinical_readings_outcome_check;
ALTER TABLE clinical_readings ADD CONSTRAINT clinical_readings_outcome_check
  CHECK (outcome IN ('unjudged','in_range','below_range','above_range'));

-- A row must carry the measurement its kind promises, and only that one. A
-- glucose row with a systolic in it is a UI bug that would otherwise be
-- invisible until somebody charted it.
ALTER TABLE clinical_readings DROP CONSTRAINT IF EXISTS clinical_readings_payload_check;
ALTER TABLE clinical_readings ADD CONSTRAINT clinical_readings_payload_check
  CHECK (
    CASE kind
      WHEN 'glucose' THEN
        glucose_mgdl IS NOT NULL AND glucose_mgdl BETWEEN 20 AND 900
        AND systolic IS NULL AND diastolic IS NULL
      WHEN 'blood_pressure' THEN
        systolic IS NOT NULL AND diastolic IS NOT NULL
        AND systolic BETWEEN 50 AND 300 AND diastolic BETWEEN 20 AND 200
        AND diastolic < systolic
        AND glucose_mgdl IS NULL
      ELSE FALSE
    END
    AND (pulse_bpm IS NULL OR pulse_bpm BETWEEN 25 AND 250)
  );

CREATE INDEX IF NOT EXISTS idx_clinical_readings_user_time
  ON clinical_readings(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_readings_session
  ON clinical_readings(session_id) WHERE session_id IS NOT NULL;

-- ============================================================
-- 3. renal_diet_plans — the dietitian's document, not ours
-- ============================================================
-- No macro solver reads this table and none ever should. The numbers are
-- transcribed from a renal dietitian's plan so the app can show a target next
-- to a log; `document_path` is the plan itself in Storage, which is the
-- authority when the transcription and the paper disagree.
CREATE TABLE IF NOT EXISTS renal_diet_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,

  dietitian_name TEXT,
  issued_on      DATE,
  document_path  TEXT,

  -- All nullable. A plan that only specifies fluid and potassium is a real
  -- plan, and demanding the other four would mean inventing them.
  calories       INTEGER,
  protein_g      NUMERIC(5,1),
  sodium_mg      INTEGER,
  potassium_mg   INTEGER,
  phosphorus_mg  INTEGER,
  fluid_ml_per_day INTEGER,

  -- The meal skeleton as written: [{ "time": "07:30", "label_en": "…",
  -- "label_ar": "…", "portions": "…" }]. JSONB rather than tables because
  -- nothing computes over it — it is rendered, and it drives the portion
  -- reminder times. Giving it a schema would invite a generator.
  meals          JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE renal_diet_plans DROP CONSTRAINT IF EXISTS renal_diet_plans_bounds_check;
ALTER TABLE renal_diet_plans ADD CONSTRAINT renal_diet_plans_bounds_check
  CHECK (
    (calories IS NULL OR calories BETWEEN 600 AND 5000)
    AND (protein_g IS NULL OR protein_g BETWEEN 10 AND 300)
    AND (sodium_mg IS NULL OR sodium_mg BETWEEN 100 AND 10000)
    AND (potassium_mg IS NULL OR potassium_mg BETWEEN 100 AND 10000)
    AND (phosphorus_mg IS NULL OR phosphorus_mg BETWEEN 100 AND 5000)
    AND (fluid_ml_per_day IS NULL OR fluid_ml_per_day BETWEEN 200 AND 5000)
    AND jsonb_typeof(meals) = 'array'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_renal_diet_plans_active
  ON renal_diet_plans(user_id) WHERE is_active = TRUE;

-- ============================================================
-- 4. fluid_logs — the one number a renal patient is asked for daily
-- ============================================================
-- Row per drink, not a running daily total, for the same reason the food diary
-- is row-per-item: a mistyped glass has to be removable without retyping the
-- day. The day's total is a SUM.
CREATE TABLE IF NOT EXISTS fluid_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  ml         INTEGER NOT NULL CHECK (ml BETWEEN 1 AND 3000),
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluid_logs_user_date
  ON fluid_logs(user_id, log_date DESC);

-- ============================================================
-- 5. renal_plan_adherence — did the day match the paper?
-- ============================================================
-- Three states and a note, once a day. Not a score: "you were 78% compliant"
-- is a number the app would have to invent from food it did not plan.
CREATE TABLE IF NOT EXISTS renal_plan_adherence (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  adherence  TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE renal_plan_adherence DROP CONSTRAINT IF EXISTS renal_plan_adherence_value_check;
ALTER TABLE renal_plan_adherence ADD CONSTRAINT renal_plan_adherence_value_check
  CHECK (adherence IN ('on_plan','partial','off_plan'));

-- ============================================================
-- 6. session_wellness — how the session went, which is what progresses him
-- ============================================================
-- "Progression driven by recovery quality and symptom flags, not by weekly
-- load increases." This table and the next are that input. One row per
-- session: whether he finished it, whether he had to stop, and how hard it
-- felt against the effort ceiling.
CREATE TABLE IF NOT EXISTS session_wellness (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
  stopped_early BOOLEAN NOT NULL DEFAULT FALSE,
  stop_reason   TEXT,
  felt          TEXT,
  -- Recovery is the next day's answer, so it lands after the fact rather than
  -- at save time. NULL = not yet asked.
  next_day_recovery TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE session_wellness DROP CONSTRAINT IF EXISTS session_wellness_felt_check;
ALTER TABLE session_wellness ADD CONSTRAINT session_wellness_felt_check
  CHECK (felt IS NULL OR felt IN ('good','ok','rough'));

ALTER TABLE session_wellness DROP CONSTRAINT IF EXISTS session_wellness_recovery_check;
ALTER TABLE session_wellness ADD CONSTRAINT session_wellness_recovery_check
  CHECK (next_day_recovery IS NULL OR next_day_recovery IN ('recovered','tired','wiped_out'));

CREATE INDEX IF NOT EXISTS idx_session_wellness_user
  ON session_wellness(user_id, created_at DESC);

-- ============================================================
-- 7. symptom_flags — the other half of the progression input
-- ============================================================
-- One row per symptom rather than an array, because the question the
-- progression rule asks is "how many times did cramping come up in the last
-- three sessions", and counting elements of an array across rows is the kind
-- of query that gets written wrong once and stays wrong.
CREATE TABLE IF NOT EXISTS symptom_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  flagged_on DATE NOT NULL,
  symptom    TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'mild',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A closed vocabulary, because these drive a rule. Free text here would mean
-- the progression logic silently ignoring "dizzy" because it was expecting
-- "dizziness".
ALTER TABLE symptom_flags DROP CONSTRAINT IF EXISTS symptom_flags_symptom_check;
ALTER TABLE symptom_flags ADD CONSTRAINT symptom_flags_symptom_check
  CHECK (symptom IN (
    'cramps','dizziness','breathlessness','chest_discomfort','palpitations',
    'swelling','access_site_pain','nausea','hypo_symptoms','unusual_fatigue',
    'joint_pain','headache'
  ));

ALTER TABLE symptom_flags DROP CONSTRAINT IF EXISTS symptom_flags_severity_check;
ALTER TABLE symptom_flags ADD CONSTRAINT symptom_flags_severity_check
  CHECK (severity IN ('mild','moderate','severe'));

CREATE INDEX IF NOT EXISTS idx_symptom_flags_user_date
  ON symptom_flags(user_id, flagged_on DESC);
CREATE INDEX IF NOT EXISTS idx_symptom_flags_session
  ON symptom_flags(session_id) WHERE session_id IS NOT NULL;

-- ============================================================
-- 8. RLS — owner-only, every table, written in the 030 subquery form
-- ============================================================
-- This is the most sensitive data in the product: a dialysis schedule, insulin
-- readings and a nephrology diet are health records, not workout preferences.
-- Owner-only for ALL, with WITH CHECK on every one so a caller cannot insert a
-- row under somebody else's user_id. The admin panel goes through service_role,
-- which bypasses RLS, so nothing here needs an is_admin escape hatch — and not
-- writing one is the point: there is no policy that widens read access to these
-- tables for a signed-in account that is not their owner.
ALTER TABLE clinical_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE renal_diet_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluid_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE renal_plan_adherence ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_wellness     ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_flags        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_clinical_profiles ON clinical_profiles;
CREATE POLICY own_clinical_profiles ON clinical_profiles FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_clinical_readings ON clinical_readings;
CREATE POLICY own_clinical_readings ON clinical_readings FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_renal_diet_plans ON renal_diet_plans;
CREATE POLICY own_renal_diet_plans ON renal_diet_plans FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_fluid_logs ON fluid_logs;
CREATE POLICY own_fluid_logs ON fluid_logs FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_renal_plan_adherence ON renal_plan_adherence;
CREATE POLICY own_renal_plan_adherence ON renal_plan_adherence FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_session_wellness ON session_wellness;
CREATE POLICY own_session_wellness ON session_wellness FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS own_symptom_flags ON symptom_flags;
CREATE POLICY own_symptom_flags ON symptom_flags FOR ALL
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- A reading, a wellness row or a flag may only ever point at the caller's own
-- session. Without this, the owner policies above check who the ROW belongs to
-- and say nothing about what it points at, so a caller could attach their own
-- reading to somebody else's session id and read it back through the join.
-- RESTRICTIVE, so it is AND-ed with the owner policy rather than OR-ed.
DROP POLICY IF EXISTS clinical_readings_own_session ON clinical_readings;
CREATE POLICY clinical_readings_own_session ON clinical_readings
  AS RESTRICTIVE FOR ALL
  USING (session_id IS NULL OR EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = clinical_readings.session_id AND s.user_id = (SELECT auth.uid())))
  WITH CHECK (session_id IS NULL OR EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = clinical_readings.session_id AND s.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS session_wellness_own_session ON session_wellness;
CREATE POLICY session_wellness_own_session ON session_wellness
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = session_wellness.session_id AND s.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = session_wellness.session_id AND s.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS symptom_flags_own_session ON symptom_flags;
CREATE POLICY symptom_flags_own_session ON symptom_flags
  AS RESTRICTIVE FOR ALL
  USING (session_id IS NULL OR EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = symptom_flags.session_id AND s.user_id = (SELECT auth.uid())))
  WITH CHECK (session_id IS NULL OR EXISTS (
    SELECT 1 FROM workout_sessions s
    WHERE s.id = symptom_flags.session_id AND s.user_id = (SELECT auth.uid())));

COMMIT;
