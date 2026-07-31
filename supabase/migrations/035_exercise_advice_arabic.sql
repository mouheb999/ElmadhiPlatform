-- 035_exercise_advice_arabic.sql
-- The in-session coaching cues, in Tunisian Arabic.
--
-- `fixed_split_exercises.advice_en` was the only copy, so an Arabic user read
-- English cues under every exercise — the one place in the workout screen that
-- never switched language. This adds the `_ar` side of the pair, the same shape
-- every other bilingual column in this schema uses, and `pick()` in
-- src/lib/i18n.ts serves whichever the locale asks for.
--
-- Cues stay pipe-separated ("a. | b. | c."); the session card splits on "|" and
-- renders one bullet per cue, so the Arabic must keep the same three-part shape.
-- The 25 distinct strings below cover all 280 rows in the sheet — the same
-- advice repeats wherever an exercise repeats.

ALTER TABLE fixed_split_exercises ADD COLUMN IF NOT EXISTS advice_ar TEXT;
ALTER TABLE user_program_exercises ADD COLUMN IF NOT EXISTS notes_ar TEXT;

COMMENT ON COLUMN fixed_split_exercises.advice_ar IS
  'Tunisian Arabic coaching cues, pipe-separated, mirroring advice_en cue for cue.';
COMMENT ON COLUMN user_program_exercises.notes_ar IS
  'Copied from fixed_split_exercises.advice_ar when the program is generated.';

-- ---------------------------------------------------------------------------
-- The translations, matched on the exact English string.
-- ---------------------------------------------------------------------------

WITH translations(en, ar) AS (VALUES
  ('Brace your abs before moving. | Keep lower back controlled. | Do not rush reps.',
   'شدّ بطنك قبل ما تتحرّك. | خلّي ظهرك السفلي مشدود. | ما تسرّعش في التكرارات.'),

  ('Brace your core before each rep. | Keep knees tracking with toes. | Control depth and stand up strong.',
   'شدّ وسطك قبل كل تكرار. | خلّي ركبتيك في اتجاه صوابع رجليك. | تحكّم في النزول واطلع بقوّة.'),

  ('Keep back against the seat. | Lift with quads, not momentum. | Squeeze at the top.',
   'خلّي ظهرك ملصوق بالكرسي. | ارفع بعضلة الفخذ، ماشي بالهزّان. | اعصر في الأعلى.'),

  ('Keep elbows controlled. | Push hard without wrist collapse. | Avoid bouncing reps.',
   'تحكّم في مرافقك. | ادفع بقوّة بلا ما يطيح معصمك. | تجنّب النقزان في التكرارات.'),

  ('Keep elbows fixed. | Use clean reps, not swinging. | Control the negative.',
   'خلّي مرافقك ثابتين. | تكرارات نظيفة، بلا هزّان. | تحكّم في النزول.'),

  ('Keep elbows pointing forward. | Feel the long head stretch. | Do not flare elbows too much.',
   'خلّي مرافقك يشيرو للقدّام. | حسّ بالتمدّد في الرأس الطويل. | ما تفتحش مرافقك برشا.'),

  ('Keep elbows stable. | Extend fully without aggressive locking. | Control the return.',
   'خلّي مرافقك ثابتين. | مدّ ذراعك كامل بلا ما تقفل بقوّة. | تحكّم في الرجوع.'),

  ('Keep feet stable and upper back tight. | Lower under control without bouncing. | Keep wrists stacked over elbows.',
   'خلّي رجليك ثابتين وأعلى ظهرك مشدود. | نزّل بتحكّم بلا نقزان. | خلّي معصميك فوق مرافقك.'),

  ('Keep hips stable. | Curl smoothly and squeeze hamstrings. | Lower the weight slowly.',
   'خلّي وركك ثابت. | اطوي بهدوء واعصر عضلة ورا الفخذ. | نزّل الوزن بالشويّة.'),

  ('Keep lower back on the pad. | Do not lock knees aggressively. | Control the depth.',
   'خلّي ظهرك السفلي ملصوق بالمسند. | ما تقفلش ركبتيك بقوّة. | تحكّم في العمق.'),

  ('Keep ribs down and core tight. | Press without arching lower back. | Lower with control.',
   'خلّي أضلعك لتحت ووسطك مشدود. | ادفع بلا ما تقوّس ظهرك السفلي. | نزّل بتحكّم.'),

  ('Keep ribs down. | Breathe normally. | Stop if lower back arches.',
   'خلّي أضلعك لتحت. | تنفّس عادي. | وقّف كان تقوّس ظهرك السفلي.'),

  ('Keep shoulder blades stable on the bench. | Lower the weight with control toward upper chest. | Push strongly without bouncing.',
   'خلّي لوحات كتفيك ثابتين على البانك. | نزّل الوزن بتحكّم في اتجاه أعلى الصدر. | ادفع بقوّة بلا نقزان.'),

  ('Keep shoulders down and chest open. | Use control and avoid swinging. | Stop the set when you stop feeling the chest.',
   'خلّي كتفيك لتحت وصدرك مفتوح. | اخدم بتحكّم وتجنّب الهزّان. | وقّف السيري كي ما تبقاش تحسّ بالصدر.'),

  ('Keep shoulders down. | Open arms with control. | Do not let traps take over.',
   'خلّي كتفيك لتحت. | افتح ذراعيك بتحكّم. | ما تخلّيش الترابيز يخدمو بلاصتك.'),

  ('Keep your spine neutral. | Pull elbows back with control. | Avoid using lower-back momentum.',
   'خلّي ظهرك مستقيم. | جبد مرافقك للور بتحكّم. | ما تستعملش ظهرك السفلي باش تهزّ.'),

  ('Lead with elbows. | Use light controlled weight. | Do not shrug.',
   'خلّي المرفق يقود الحركة. | وزن خفيف ومتحكّم فيه. | ما ترفعش كتفيك.'),

  ('Let the biceps stretch safely. | Keep shoulder stable. | Curl with control.',
   'خلّي البيسبس يتمدّد بأمان. | خلّي كتفك ثابت. | اطوي بتحكّم.'),

  ('Lift shoulders straight up. | Pause briefly at the top. | Keep neck relaxed.',
   'ارفع كتفيك لفوق نيشان. | وقّف شويّة في الأعلى. | خلّي رقبتك مرتاحة.'),

  ('Move from the hip. | Squeeze glutes at the top. | Use control instead of momentum.',
   'الحركة تجي من الورك. | اعصر مؤخرتك في الأعلى. | اخدم بتحكّم ماشي بالهزّان.'),

  ('Pull elbows down toward your ribs. | Keep chest up and shoulders away from ears. | Control the stretch at the top.',
   'جبد مرافقك لتحت في اتجاه أضلعك. | خلّي صدرك مرفوع وكتفيك بعيدين على وذنيك. | تحكّم في التمدّد في الأعلى.'),

  ('Push hips back. | Keep knees slightly bent. | Feel hamstrings stretch without back pain.',
   'دفّ وركك للور. | خلّي ركبتيك مثنيين شويّة. | حسّ بتمدّد ورا الفخذ بلا وجيعة في الظهر.'),

  ('Push through heels. | Squeeze glutes at the top. | Do not over-arch lower back.',
   'ادفع من كعوب رجليك. | اعصر مؤخرتك في الأعلى. | ما تقوّسش ظهرك السفلي برشا.'),

  ('Use controlled technique. | Avoid pain and ego lifting. | Progress slowly week by week.',
   'اخدم بتقنية متحكّم فيها. | تجنّب الوجيعة والأوزان الكبيرة على الفارغ. | زيد بالشويّة جمعة بجمعة.'),

  ('Use full range. | Pause at the top. | Do not bounce.',
   'اخدم المدى كامل. | وقّف في الأعلى. | ما تنقزش.')
)
UPDATE fixed_split_exercises f
SET advice_ar = t.ar
FROM translations t
WHERE f.advice_en = t.en;

-- ---------------------------------------------------------------------------
-- Backfill the programs already generated.
-- ---------------------------------------------------------------------------
-- Existing users keep their program for good (nothing regenerates it), so
-- without this they would read English cues until their next rebuild. The
-- mapping is derived from the table just updated rather than repeating the
-- list, so the two can never disagree.

UPDATE user_program_exercises u
SET notes_ar = f.advice_ar
FROM (
  SELECT DISTINCT advice_en, advice_ar
  FROM fixed_split_exercises
  WHERE advice_ar IS NOT NULL
) f
WHERE u.notes = f.advice_en
  AND u.notes_ar IS NULL;
