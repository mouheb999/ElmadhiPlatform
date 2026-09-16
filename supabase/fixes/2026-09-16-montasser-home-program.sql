-- 2026-09-16 — montasserbodhina@gmail.com: the home program he actually asked for.
--
-- WHAT WENT WRONG
-- He answered the workout questionnaire on 16/09/2026: goal hypertrophy,
-- beginner, 4 days a week, "Home only", equipment = dumbbells, bands, pull-up
-- bar, bodyweight, no injuries. The generator handed him
-- `pull_push_legs_upper_4day_male` — 28 exercises, 13 of them machines, 5
-- cables, plus a Back Squat and a Close-Grip Bench Press. Not one movement he
-- could do in his house. He opened a support ticket saying exactly that.
--
-- WHAT THIS DOES
-- Replaces that program with the coach-written Push / Pull / Legs / Full Body
-- home plan. The old program is kept, deactivated, as version 1 — every read
-- path (program, dashboard, rationale, session) filters on is_active, so
-- nothing shows it, and it is there if the plan needs to be rolled back.
--
-- The new program is marked `is_custom` / `split_type = 'custom'`, which is
-- what /workout/rationale reads to stop explaining generator reasoning that
-- did not happen here.
--
-- Bilingual by construction: exercise names come from the catalog
-- (exercises.name_en / name_ar) and every coaching cue is written into both
-- `notes` and `notes_ar`, so the program and session screens read fully in
-- whichever language he has selected.
--
-- Rep ranges stay inside REP_RANGE_PATTERN (`\d{1,2}(-\d{1,2})?`), so he can
-- still edit them in the app. Where the sheet gave something the column cannot
-- hold — "max reps", "60 sec", "100-150 total" — the intent is carried in the
-- note and the numbers are the honest equivalent (e.g. Full Body push-ups:
-- 10 sets of 10-15 is the sheet's 100-150 total).
--
-- Requires: supabase/migrations/053_home_catalog_additions.sql (Dumbbell Floor
-- Press, Dumbbell RDL). Re-runnable: it no-ops once the custom program is live.

BEGIN;

DO $$
DECLARE
  v_user    UUID;
  v_profile UUID;
  v_program UUID;
  v_day     UUID;
BEGIN
  SELECT id INTO v_user FROM profiles WHERE email = 'montasserbodhina@gmail.com';
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No profile for montasserbodhina@gmail.com';
  END IF;

  SELECT id INTO v_profile
    FROM training_profiles
   WHERE user_id = v_user AND is_active
   ORDER BY version DESC
   LIMIT 1;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'No active training profile for %', v_user;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_programs
     WHERE user_id = v_user AND is_active AND is_custom
  ) THEN
    RAISE NOTICE 'Home program already in place — nothing to do.';
    RETURN;
  END IF;

  UPDATE user_programs SET is_active = FALSE WHERE user_id = v_user AND is_active;

  INSERT INTO user_programs (
    user_id, training_profile_id, version, is_active, name, split_type,
    is_custom, user_modified
  )
  VALUES (
    v_user, v_profile,
    (SELECT COALESCE(MAX(version), 0) + 1 FROM user_programs WHERE user_id = v_user),
    TRUE, 'Push / Pull / Legs / Full Body', 'custom', TRUE, TRUE
  )
  RETURNING id INTO v_program;

  -- ---------------- Day 1 — Push (chest, shoulders, triceps) ----------------
  INSERT INTO user_program_days (user_program_id, day_number, day_name)
  VALUES (v_program, 1, 'Push') RETURNING id INTO v_day;

  INSERT INTO user_program_exercises (
    user_program_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes, notes_ar
  )
  SELECT v_day, e.id, x.order_index, x.sets, x.rep_range, x.rest_seconds, x.notes, x.notes_ar
    FROM (VALUES
      ('incline-push-up',      0::INT, 4::INT, '15',    60::INT,
       'Hands on a raised surface — a bench, a table or a windowsill.',
       'اليدين على سطح مرتفع — مقعد أو طاولة.'),
      ('dumbbell-floor-press', 1, 3, '12', 90,
       'Full control on the way down and on the way up.',
       'تحكم كامل في النزول والصعود.'),
      ('pike-push-up',         2, 3, '10', 60,
       'Superset — go straight into the Lateral Raises, 10 reps each.',
       'سوبرست — انتقل مباشرة إلى الرفع الجانبي، 10 تكرارات لكل تمرين.'),
      ('lateral-raise',        3, 3, '10', 60,
       'Superset with Pike Push-Ups — 10 reps each, light dumbbells.',
       'سوبرست مع الضغط الهرمي — 10 تكرارات لكل تمرين، دمبل خفيف.'),
      ('diamond-push-up',      4, 3, '10-20', 90,
       'Finisher superset with Bench Dips — reps to capacity, stop before form breaks.',
       'فينيشر سوبرست مع غطس المقعد — حسب القدرة، توقف قبل انهيار التقنية.'),
      ('bench-dip',            5, 3, '10-20', 90,
       'Finisher superset with Diamond Push-Ups — reps to capacity.',
       'فينيشر سوبرست مع ضغط الماسة — حسب القدرة.')
    ) AS x(slug, order_index, sets, rep_range, rest_seconds, notes, notes_ar)
    JOIN exercises e ON e.slug = x.slug;

  -- ---------------- Day 2 — Pull (back, biceps) ----------------
  INSERT INTO user_program_days (user_program_id, day_number, day_name)
  VALUES (v_program, 2, 'Pull') RETURNING id INTO v_day;

  INSERT INTO user_program_exercises (
    user_program_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes, notes_ar
  )
  SELECT v_day, e.id, x.order_index, x.sets, x.rep_range, x.rest_seconds, x.notes, x.notes_ar
    FROM (VALUES
      ('pull-up',       0::INT, 5::INT, '7',    90::INT,
       'Keep the full range of motion on every rep.',
       'حافظ على الحركة الكاملة في كل تكرار.'),
      ('dumbbell-row',  1, 2, '10',   75,
       '10 reps each side.',
       '10 تكرارات لكل جهة.'),
      ('chin-up',       2, 3, '6-10', 90,
       'Max reps — stop before your technique breaks down.',
       'أقصى عدد ممكن — توقف قبل انهيار التقنية.'),
      ('dumbbell-curl', 3, 3, '10',   60,
       'No swinging — the elbows stay still.',
       'بدون تأرجح — المرفقان ثابتان.')
    ) AS x(slug, order_index, sets, rep_range, rest_seconds, notes, notes_ar)
    JOIN exercises e ON e.slug = x.slug;

  -- ---------------- Day 3 — Legs ----------------
  INSERT INTO user_program_days (user_program_id, day_number, day_name)
  VALUES (v_program, 3, 'Legs') RETURNING id INTO v_day;

  INSERT INTO user_program_exercises (
    user_program_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes, notes_ar
  )
  SELECT v_day, e.id, x.order_index, x.sets, x.rep_range, x.rest_seconds, x.notes, x.notes_ar
    FROM (VALUES
      ('bodyweight-calf-raise', 0::INT, 4::INT, '15',    45::INT,
       'Bodyweight, or hold a dumbbell.',
       'بوزن الجسم أو دمبل.'),
      ('goblet-squat',          1, 4, '10-15', 90,
       'Dumbbell held at the chest.',
       'الدمبل أمام الصدر.'),
      ('walking-lunge',         2, 4, '20',    75,
       'About 60 seconds of continuous walking per set — roughly 20 steps.',
       'حوالي 60 ثانية حركة مستمرة لكل مجموعة — تقريباً 20 خطوة.'),
      ('dumbbell-rdl',          3, 2, '10',    90,
       'Control the way down and feel the hamstrings stretch.',
       'تحكم في النزول وشد الخلفية.')
    ) AS x(slug, order_index, sets, rep_range, rest_seconds, notes, notes_ar)
    JOIN exercises e ON e.slug = x.slug;

  -- ---------------- Day 4 — Full Body (volume day) ----------------
  INSERT INTO user_program_days (user_program_id, day_number, day_name)
  VALUES (v_program, 4, 'Full Body') RETURNING id INTO v_day;

  INSERT INTO user_program_exercises (
    user_program_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes, notes_ar
  )
  SELECT v_day, e.id, x.order_index, x.sets, x.rep_range, x.rest_seconds, x.notes, x.notes_ar
    FROM (VALUES
      ('push-up',          0::INT, 10::INT, '10-15', 60::INT,
       '100-150 reps in total — split them into sets you can control.',
       'المجموع 100–150 تكرار — قسّم العدد إلى مجموعات مناسبة.'),
      ('pull-up',          1, 10, '5-7',   90,
       '50-70 reps in total — split them without sacrificing technique.',
       'المجموع 50–70 تكرار — قسّم العدد بدون التضحية بالتقنية.'),
      ('bodyweight-squat', 2, 10, '10-15', 60,
       '100-150 reps in total — moderate, controlled sets.',
       'المجموع 100–150 تكرار — مجموعات متوسطة ومتحكم بها.')
    ) AS x(slug, order_index, sets, rep_range, rest_seconds, notes, notes_ar)
    JOIN exercises e ON e.slug = x.slug;

  -- The sheet's one-hour outdoor walk. Cardio is its own block by design
  -- (migration 051) — it is not a set-and-rep row and must not be logged as one.
  INSERT INTO user_program_cardio (user_program_day_id, exercise_id, minutes)
  SELECT v_day, e.id, 60 FROM exercises e WHERE e.slug = 'speed-walking';

  RAISE NOTICE 'Home program % created for %', v_program, v_user;
END $$;

COMMIT;
