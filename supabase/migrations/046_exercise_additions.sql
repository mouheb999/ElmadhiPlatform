-- 046_exercise_additions.sql
-- Adds 39 exercises from hype_exercise_additions_ar_en_v1.json (41 in the file;
-- 'Decline Push-Up' and 'Pike Push-Up' are already in the catalog and are left
-- untouched — only their missing Arabic explanation is filled in at the end).
--
-- Data only. No schema change, no existing row rewritten, no split touched:
-- generated programs copy `fixed_split_exercises` verbatim (migration 027), so
-- nothing here changes any program that already exists. The new rows surface in
-- the custom builder's picker, the program editor's "add an exercise" picker,
-- and — where the substitution group matches — its swap suggestions.
--
-- Four columns the app runs on are NOT in the source file and are derived here
-- from the nearest existing catalog entry (e.g. Smith flat press follows
-- machine-chest-press, weighted pull-up follows pull-up):
--   role + sub_target      migration 024 — `exercises_role_by_type_check` makes
--                          role NOT NULL for every strength row, so a row
--                          without one cannot be inserted at all.
--   substitution_group     migration 021 — drives the swap list in the program
--                          editor.
--   exercise_ratings       migration 019/020 — tier + home_friendly.
-- Every derived row is flagged needs_role_review / needs_tier_review /
-- needs_injury_review for the same manual sign-off pass 019 set up.
--
-- `avoid_injuries` is mapped onto the six values training_profiles.injuries is
-- constrained to (022): shoulder->Shoulder, elbow/wrist->Wrist / elbow,
-- low back->Lower back, knee->Knee, neck->Neck. Sternum pain, hip pain,
-- balance issues, hamstring strain and door instability have no equivalent
-- there and are dropped rather than stored as values nothing can ever match;
-- they stay in the Arabic explanation, which is where the user reads them.
--
-- The Arabic explanation lands in `exercises.instructions` (admin-only field;
-- no user-facing screen reads it). `video_url` stays NULL — the source file
-- ships empty strings for manual linking later, and NULL is what the media
-- component tests for.
--
-- Illustrations: none of these 39 have one yet. `illustrationFor()` looks up
-- slugify(name_en) in exercise-illustrations.json and returns null on a miss,
-- which renders no thumbnail rather than a broken one. Renaming any row below
-- silently breaks that join.
--
-- Idempotent: ON CONFLICT DO NOTHING on both inserts.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

INSERT INTO exercises
  (slug, name_en, name_ar, exercise_type, primary_muscle,
   secondary_muscles, equipment, movement_pattern, difficulty,
   contraindicated_for, instructions,
   role, sub_target, substitution_group)
VALUES
  ('weighted-chest-dip', 'Weighted Chest Dip', 'غطس صدر بوزن إضافي', 'strength', 'chest',
   ARRAY['triceps','shoulders']::TEXT[], 'bodyweight', 'push', 'advanced',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'ضع وزن إضافي بحزام أو دمبل بين الرجلين، انزل بتحكم حتى تحس بتمدد في الصدر، ثم ادفع للأعلى. مناسب فقط بعد إتقان الغطس العادي.',
   'opener_compound', 'chest_dip', 'chest_chest_dip'),
  ('smith-machine-flat-bench-press', 'Smith Machine Flat Bench Press', 'ضغط صدر سميث مستوي', 'strength', 'chest',
   ARRAY['triceps','shoulders']::TEXT[], 'machine', 'push', 'intermediate',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'استلق تحت جهاز السميث، انزل البار نحو منتصف الصدر، ثم ادفع للأعلى مع تثبيت لوح الكتف.',
   'mid_compound_machine', 'horizontal_press', 'chest_horizontal_press'),
  ('smith-machine-incline-bench-press', 'Smith Machine Incline Bench Press', 'ضغط صدر سميث مائل', 'strength', 'chest',
   ARRAY['shoulders','triceps']::TEXT[], 'machine', 'push', 'intermediate',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'اضبط المقعد على ميل خفيف، انزل البار نحو أعلى الصدر، ثم ادفع للأعلى بدون تقويس زائد للظهر.',
   'mid_compound_machine', 'incline_press', 'chest_incline_press'),
  ('decline-dumbbell-press', 'Decline Dumbbell Press', 'ضغط دمبل منحدر', 'strength', 'chest',
   ARRAY['triceps','shoulders']::TEXT[], 'dumbbell', 'push', 'intermediate',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'استلق على مقعد منحدر، انزل الدمبل بجانب الصدر، ثم ادفع للأعلى مع تحكم كامل.',
   'mid_compound', 'decline_press', 'chest_decline_press'),
  ('low-to-high-cable-fly', 'Low-to-High Cable Fly', 'تفتيح كابل منخفض إلى عالي', 'strength', 'chest',
   ARRAY['shoulders']::TEXT[], 'cable', 'push', 'intermediate',
   ARRAY['Shoulder']::TEXT[], 'اسحب الكابل من الأسفل إلى الأعلى أمام الصدر، وركز على عصر عضلة الصدر في نهاية الحركة.',
   'mid_isolation', 'chest_fly', 'chest_chest_fly'),
  ('high-to-low-cable-fly', 'High-to-Low Cable Fly', 'تفتيح كابل عالي إلى منخفض', 'strength', 'chest',
   ARRAY['shoulders']::TEXT[], 'cable', 'push', 'intermediate',
   ARRAY['Shoulder']::TEXT[], 'اسحب الكابل من الأعلى إلى الأسفل باتجاه وسط الجسم، وحافظ على انثناء بسيط في المرفقين.',
   'mid_isolation', 'chest_fly', 'chest_chest_fly'),
  ('single-arm-machine-chest-press', 'Single-Arm Machine Chest Press', 'ضغط صدر آلة بذراع واحدة', 'strength', 'chest',
   ARRAY['triceps','shoulders']::TEXT[], 'machine', 'push', 'beginner',
   ARRAY['Shoulder']::TEXT[], 'ادفع بذراع واحدة في جهاز الصدر، حافظ على الجذع ثابت، واستعمله لتصحيح الفرق بين الجهتين.',
   'mid_compound_machine', 'horizontal_press', 'chest_horizontal_press'),
  ('weighted-pull-up', 'Weighted Pull-Up', 'عقلة بوزن إضافي', 'strength', 'back',
   ARRAY['biceps','forearms']::TEXT[], 'bodyweight', 'pull', 'advanced',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'أضف وزن بحزام أو دمبل، اسحب جسمك حتى يقترب الذقن من البار، ثم انزل بتحكم.',
   'opener_compound', 'vertical_pull', 'back_vertical_pull'),
  ('weighted-chin-up', 'Weighted Chin-Up', 'عقلة قبضة عكسية بوزن إضافي', 'strength', 'biceps',
   ARRAY['back','forearms']::TEXT[], 'bodyweight', 'pull', 'advanced',
   ARRAY['Wrist / elbow','Shoulder']::TEXT[], 'استعمل قبضة عكسية، اسحب الصدر نحو البار، ثم انزل ببطء. ممتاز للبايسبس والظهر.',
   'opener_compound', 'chin_up', 'biceps_chin_up'),
  ('negative-pull-up', 'Negative Pull-Up', 'عقلة سلبية', 'strength', 'back',
   ARRAY['biceps','forearms']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'اصعد بمساعدة أو قفز، ثم انزل ببطء 3 إلى 5 ثواني. تمرين ممتاز لتعلم العقلة.',
   'mid_compound', 'vertical_pull', 'back_vertical_pull'),
  ('scapular-pull-up', 'Scapular Pull-Up', 'سحب كتف من وضع العقلة', 'strength', 'back',
   ARRAY['shoulders','forearms']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder']::TEXT[], 'تعلق بالبار بدون ثني المرفقين، اسحب لوحي الكتف للأسفل، ثم ارجع بتحكم.',
   'opener_isolation', 'scapular_prep', 'back_scapular_prep'),
  ('single-arm-lat-pulldown', 'Single-Arm Lat Pulldown', 'سحب علوي بذراع واحدة', 'strength', 'back',
   ARRAY['biceps','forearms']::TEXT[], 'cable', 'pull', 'intermediate',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'اسحب المقبض بذراع واحدة نحو جانب الصدر، وحافظ على الكتف منخفض والظهر ثابت.',
   'mid_compound', 'vertical_pull', 'back_vertical_pull'),
  ('chest-supported-machine-row', 'Chest-Supported Machine Row', 'تجديف آلة مسنود على الصدر', 'strength', 'back',
   ARRAY['biceps','shoulders']::TEXT[], 'machine', 'pull', 'beginner',
   ARRAY['Shoulder','Lower back']::TEXT[], 'ثبت الصدر على الجهاز، اسحب المقابض نحو الجسم، واعصر لوحي الكتف للخلف.',
   'mid_compound_machine', 'horizontal_row', 'back_horizontal_row'),
  ('high-cable-row', 'High Cable Row', 'تجديف كابل عالي للظهر العلوي', 'strength', 'back',
   ARRAY['shoulders','biceps']::TEXT[], 'cable', 'pull', 'intermediate',
   ARRAY['Shoulder','Neck']::TEXT[], 'اسحب الكابل نحو أعلى الصدر مع فتح المرفقين، وركز على الظهر العلوي والأكتاف الخلفية.',
   'mid_compound', 'horizontal_row', 'back_horizontal_row'),
  ('cable-pullover', 'Cable Pullover', 'بولوفر بالكابل', 'strength', 'back',
   ARRAY['chest','shoulders']::TEXT[], 'cable', 'pull', 'intermediate',
   ARRAY['Shoulder']::TEXT[], 'امسك الحبل أو البار، حافظ على المرفقين شبه ثابتين، واسحب من أعلى إلى أسفل حتى تشعر بعضلة الظهر الجانبية.',
   'mid_isolation', 'pullover', 'chest_pullover'),
  ('machine-pullover', 'Machine Pullover', 'بولوفر آلة', 'strength', 'back',
   ARRAY['chest','shoulders']::TEXT[], 'machine', 'pull', 'beginner',
   ARRAY['Shoulder']::TEXT[], 'اجلس في جهاز البولوفر، اسحب الذراعين للأسفل بالقوس الطبيعي، وركز على الظهر وليس الذراعين.',
   'mid_compound_machine', 'pullover', 'chest_pullover'),
  ('slow-tempo-push-up', 'Slow Tempo Push-Up', 'ضغط بطيء', 'strength', 'chest',
   ARRAY['triceps','shoulders','core']::TEXT[], 'bodyweight', 'push', 'beginner',
   ARRAY['Wrist / elbow','Shoulder']::TEXT[], 'انزل في 3 ثواني، توقف لحظة، ثم ادفع للأعلى. ممتاز للبيت عندما لا يوجد معدات.',
   'mid_compound', 'horizontal_press', 'chest_horizontal_press'),
  ('paused-push-up', 'Paused Push-Up', 'ضغط مع توقف أسفل الحركة', 'strength', 'chest',
   ARRAY['triceps','shoulders','core']::TEXT[], 'bodyweight', 'push', 'intermediate',
   ARRAY['Wrist / elbow','Shoulder']::TEXT[], 'انزل حتى يقترب الصدر من الأرض، توقف ثانية، ثم ادفع. التوقف يزيد التحكم ويقلل الغش.',
   'mid_compound', 'horizontal_press', 'chest_horizontal_press'),
  ('close-grip-push-up', 'Close-Grip Push-Up', 'ضغط ضيق للترايسبس', 'strength', 'triceps',
   ARRAY['chest','shoulders']::TEXT[], 'bodyweight', 'push', 'intermediate',
   ARRAY['Wrist / elbow']::TEXT[], 'ضع اليدين أضيق من عرض الكتفين، انزل بتحكم، وركز على دفع الأرض بالكفين.',
   'finisher_compound', 'close_grip_press', 'triceps_close_grip_press'),
  ('spiderman-push-up', 'Spiderman Push-Up', 'ضغط سبايدرمان', 'strength', 'chest',
   ARRAY['triceps','shoulders','core']::TEXT[], 'bodyweight', 'push', 'advanced',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'أثناء النزول، ارفع ركبة نحو الكوع من نفس الجهة، ثم ارجع. تمرين قوي للصدر والكور.',
   'mid_compound', 'horizontal_press', 'chest_horizontal_press'),
  ('plank-to-push-up', 'Plank to Push-Up', 'ضغط بلانك إلى ضغط', 'strength', 'chest',
   ARRAY['triceps','shoulders','core']::TEXT[], 'bodyweight', 'push', 'intermediate',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'ابدأ من بلانك على الساعدين، اصعد إلى وضع الضغط يدًا بيد، ثم ارجع مع ثبات الحوض.',
   'finisher_compound', 'horizontal_press', 'chest_horizontal_press'),
  ('table-inverted-row', 'Table Inverted Row', 'عقلة أسترالية تحت الطاولة', 'strength', 'back',
   ARRAY['biceps','forearms']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder','Lower back']::TEXT[], 'تمسك بحافة طاولة قوية، جسمك مستقيم، واسحب صدرك نحو الطاولة. تأكد أن الطاولة ثابتة.',
   'mid_compound', 'horizontal_row', 'back_horizontal_row'),
  ('towel-door-row', 'Towel Door Row', 'سحب منشفة على الباب', 'strength', 'back',
   ARRAY['biceps','forearms']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder']::TEXT[], 'ثبت منشفة في باب قوي ومغلق، امسك الطرفين، ارجع للخلف واسحب صدرك نحو الباب. افحص الأمان قبل التمرين.',
   'finisher_compound', 'horizontal_row', 'back_horizontal_row'),
  ('superman-lat-pull', 'Superman Lat Pull', 'سوبرمان بسحب الظهر', 'strength', 'back',
   ARRAY['glutes','hamstrings','shoulders']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Lower back']::TEXT[], 'ارفع الصدر والرجلين قليلًا، ثم اسحب المرفقين نحو الجسم كأنك تعمل سحب علوي.',
   'finisher_isolation', 'spinal_extension', 'back_spinal_extension'),
  ('towel-pullover', 'Towel Pullover', 'بولوفر بالمنشفة', 'strength', 'back',
   ARRAY['shoulders','chest']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder']::TEXT[], 'امسك منشفة مشدودة فوق الرأس، اسحبها للأسفل بخيال مقاومة مع شد الظهر. بديل منزلي خفيف.',
   'finisher_isolation', 'pullover', 'chest_pullover'),
  ('active-hang', 'Active Hang', 'تعليق نشط', 'strength', 'back',
   ARRAY['forearms','shoulders']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Shoulder','Wrist / elbow']::TEXT[], 'تعلق بالبار واسحب كتفيك للأسفل بعيدًا عن الأذنين. حافظ على التحكم والتنفس.',
   'opener_isolation', 'scapular_prep', 'back_scapular_prep'),
  ('slow-bodyweight-squat', 'Slow Bodyweight Squat', 'سكوات بوزن الجسم بطيء', 'strength', 'quads',
   ARRAY['glutes','hamstrings','core']::TEXT[], 'bodyweight', 'squat', 'beginner',
   ARRAY['Knee','Lower back']::TEXT[], 'انزل ببطء، حافظ على الركبتين في اتجاه القدمين، وادفع الأرض للرجوع.',
   'mid_compound', 'squat', 'quads_squat'),
  ('paused-bodyweight-squat', 'Paused Bodyweight Squat', 'سكوات مع توقف', 'strength', 'quads',
   ARRAY['glutes','hamstrings','core']::TEXT[], 'bodyweight', 'squat', 'beginner',
   ARRAY['Knee']::TEXT[], 'توقف ثانية في أسفل السكوات ثم اصعد. يزيد التحكم ويقوي الفورمة.',
   'mid_compound', 'squat', 'quads_squat'),
  ('bodyweight-sumo-squat', 'Bodyweight Sumo Squat', 'سكوات سومو بوزن الجسم', 'strength', 'quads',
   ARRAY['glutes','hamstrings']::TEXT[], 'bodyweight', 'squat', 'beginner',
   ARRAY['Knee']::TEXT[], 'افتح القدمين أوسع من الكتفين، انزل بتحكم، وادفع من الكعبين.',
   'mid_compound', 'squat', 'quads_squat'),
  ('bodyweight-forward-lunge', 'Bodyweight Forward Lunge', 'اندفاع للأمام بوزن الجسم', 'strength', 'quads',
   ARRAY['glutes','hamstrings','core']::TEXT[], 'bodyweight', 'squat', 'beginner',
   ARRAY['Knee']::TEXT[], 'خذ خطوة للأمام، انزل حتى تقترب الركبة الخلفية من الأرض، ثم ادفع للرجوع.',
   'mid_compound', 'lunge', 'quads_lunge'),
  ('bodyweight-reverse-lunge', 'Bodyweight Reverse Lunge', 'اندفاع للخلف بوزن الجسم', 'strength', 'quads',
   ARRAY['glutes','hamstrings','core']::TEXT[], 'bodyweight', 'squat', 'beginner',
   ARRAY['Knee']::TEXT[], 'ارجع خطوة للخلف وانزل بتحكم. غالبًا أسهل على الركبة من الاندفاع للأمام.',
   'mid_compound', 'lunge', 'quads_lunge'),
  ('bodyweight-bulgarian-split-squat', 'Bodyweight Bulgarian Split Squat', 'سكوات بلغاري بوزن الجسم', 'strength', 'quads',
   ARRAY['glutes','hamstrings']::TEXT[], 'bodyweight', 'squat', 'intermediate',
   ARRAY['Knee']::TEXT[], 'ضع القدم الخلفية على كرسي، انزل بالرجل الأمامية ثم اصعد. حافظ على التوازن.',
   'opener_compound', 'lunge', 'quads_lunge'),
  ('towel-hamstring-curl', 'Towel Hamstring Curl', 'انزلاق هامسترينغ بمنشفة', 'strength', 'hamstrings',
   ARRAY['glutes','core']::TEXT[], 'bodyweight', 'hinge', 'intermediate',
   ARRAY['Lower back']::TEXT[], 'على أرض ناعمة، ضع منشفة تحت الكعبين، ارفع الحوض واسحب الكعبين نحوك ثم مدّهما بتحكم.',
   'mid_isolation', 'leg_curl', 'hamstrings_leg_curl'),
  ('chair-hip-thrust', 'Chair Hip Thrust', 'دفع الورك على الكرسي', 'strength', 'glutes',
   ARRAY['hamstrings','core']::TEXT[], 'bodyweight', 'hinge', 'beginner',
   ARRAY['Lower back']::TEXT[], 'اسند أعلى الظهر على كرسي، ارفع الحوض حتى يستقيم الجسم، واضغط الألوية في الأعلى.',
   'mid_compound', 'hip_thrust', 'glutes_hip_thrust'),
  ('long-lever-plank', 'Long-Lever Plank', 'بلانك طويل الذراعين', 'strength', 'core',
   ARRAY['shoulders']::TEXT[], 'bodyweight', 'rotation', 'advanced',
   ARRAY['Lower back','Shoulder']::TEXT[], 'ادفع اليدين للأمام أكثر من البلانك العادي وحافظ على الحوض ثابت. لا تترك الظهر يهبط.',
   'mid_isolation', 'plank', 'core_plank'),
  ('plank-leg-lift', 'Plank Leg Lift', 'بلانك مع رفع رجل', 'strength', 'core',
   ARRAY['glutes','shoulders']::TEXT[], 'bodyweight', 'rotation', 'intermediate',
   ARRAY['Lower back','Shoulder']::TEXT[], 'من وضع البلانك، ارفع رجلًا واحدة بدون تحريك الحوض، ثم بدل.',
   'mid_isolation', 'plank', 'core_plank'),
  ('heel-touch-crunch', 'Heel Touch Crunch', 'كرنش لمس الكعب', 'strength', 'core',
   '{}'::TEXT[], 'bodyweight', 'rotation', 'beginner',
   ARRAY['Neck','Lower back']::TEXT[], 'استلقِ واثنِ الركبتين، المس الكعبين يمينًا ويسارًا مع شد البطن.',
   'finisher_isolation', 'crunch', 'core_crunch'),
  ('towel-biceps-curl', 'Towel Biceps Curl', 'مرجحة بايسبس بمنشفة', 'strength', 'biceps',
   ARRAY['forearms']::TEXT[], 'bodyweight', 'pull', 'beginner',
   ARRAY['Wrist / elbow']::TEXT[], 'امسك منشفة تحت القدم واسحبها كأنك تعمل curl، وغيّر قوة المقاومة برجلك.',
   'finisher_isolation', 'biceps_curl', 'biceps_biceps_curl'),
  ('self-resisted-triceps-extension', 'Self-Resisted Triceps Extension', 'تمديد ترايسبس ذاتي المقاومة', 'strength', 'triceps',
   ARRAY['shoulders']::TEXT[], 'bodyweight', 'push', 'beginner',
   ARRAY['Wrist / elbow','Shoulder']::TEXT[], 'استعمل اليد الأخرى لتقاوم مدّ الذراع. حافظ على المرفق ثابت.',
   'finisher_isolation', 'triceps_extension', 'triceps_triceps_extension')
ON CONFLICT (slug) DO NOTHING;

-- Flag only the rows this migration inserted, and only the fields it derived.
UPDATE exercises SET
  needs_role_review   = TRUE,
  needs_tier_review   = TRUE,
  needs_injury_review = TRUE
WHERE slug IN ('weighted-chest-dip', 'smith-machine-flat-bench-press', 'smith-machine-incline-bench-press', 'decline-dumbbell-press', 'low-to-high-cable-fly', 'high-to-low-cable-fly', 'single-arm-machine-chest-press', 'weighted-pull-up', 'weighted-chin-up', 'negative-pull-up', 'scapular-pull-up', 'single-arm-lat-pulldown', 'chest-supported-machine-row', 'high-cable-row', 'cable-pullover', 'machine-pullover', 'slow-tempo-push-up', 'paused-push-up', 'close-grip-push-up', 'spiderman-push-up', 'plank-to-push-up', 'table-inverted-row', 'towel-door-row', 'superman-lat-pull', 'towel-pullover', 'active-hang', 'slow-bodyweight-squat', 'paused-bodyweight-squat', 'bodyweight-sumo-squat', 'bodyweight-forward-lunge', 'bodyweight-reverse-lunge', 'bodyweight-bulgarian-split-squat', 'towel-hamstring-curl', 'chair-hip-thrust', 'long-lever-plank', 'plank-leg-lift', 'heel-touch-crunch', 'towel-biceps-curl', 'self-resisted-triceps-extension');

-- Tier + home_friendly. Joined on slug so the UUIDs stay generated.
INSERT INTO exercise_ratings (exercise_id, tier, home_friendly)
SELECT e.id, v.tier, v.home
FROM (VALUES
  ('weighted-chest-dip', 'S', TRUE),
  ('smith-machine-flat-bench-press', 'A', FALSE),
  ('smith-machine-incline-bench-press', 'A', FALSE),
  ('decline-dumbbell-press', 'A', TRUE),
  ('low-to-high-cable-fly', 'A', FALSE),
  ('high-to-low-cable-fly', 'A', FALSE),
  ('single-arm-machine-chest-press', 'A', FALSE),
  ('weighted-pull-up', 'S', TRUE),
  ('weighted-chin-up', 'S', TRUE),
  ('negative-pull-up', 'A', TRUE),
  ('scapular-pull-up', 'B', TRUE),
  ('single-arm-lat-pulldown', 'A', FALSE),
  ('chest-supported-machine-row', 'A', FALSE),
  ('high-cable-row', 'A', FALSE),
  ('cable-pullover', 'A', FALSE),
  ('machine-pullover', 'A', FALSE),
  ('slow-tempo-push-up', 'A', TRUE),
  ('paused-push-up', 'A', TRUE),
  ('close-grip-push-up', 'B', TRUE),
  ('spiderman-push-up', 'A', TRUE),
  ('plank-to-push-up', 'B', TRUE),
  ('table-inverted-row', 'B', TRUE),
  ('towel-door-row', 'B', TRUE),
  ('superman-lat-pull', 'B', TRUE),
  ('towel-pullover', 'B', TRUE),
  ('active-hang', 'B', TRUE),
  ('slow-bodyweight-squat', 'A', TRUE),
  ('paused-bodyweight-squat', 'A', TRUE),
  ('bodyweight-sumo-squat', 'B', TRUE),
  ('bodyweight-forward-lunge', 'A', TRUE),
  ('bodyweight-reverse-lunge', 'A', TRUE),
  ('bodyweight-bulgarian-split-squat', 'S', TRUE),
  ('towel-hamstring-curl', 'B', TRUE),
  ('chair-hip-thrust', 'A', TRUE),
  ('long-lever-plank', 'A', TRUE),
  ('plank-leg-lift', 'A', TRUE),
  ('heel-touch-crunch', 'B', TRUE),
  ('towel-biceps-curl', 'B', TRUE),
  ('self-resisted-triceps-extension', 'B', TRUE)
) AS v(slug, tier, home)
JOIN exercises e ON e.slug = v.slug
ON CONFLICT (exercise_id) DO NOTHING;

-- The two rows already in the catalog: keep every existing value, add only the
-- Arabic explanation they never had.
UPDATE exercises SET instructions = v.explanation
FROM (VALUES
  ('decline-push-up', 'ضع رجليك على كرسي ثابت، حافظ على جسم مستقيم، وانزل بالصدر نحو الأرض.'),
  ('pike-push-up', 'ارفع الحوض للأعلى كحرف V، انزل بالرأس بين اليدين ثم ادفع. ممتاز للكتف في البيت.')
) AS v(slug, explanation)
WHERE exercises.slug = v.slug AND exercises.instructions IS NULL;

COMMIT;

-- ROLLBACK: pre-commit run ROLLBACK; instead of COMMIT;
-- Post-commit (exercise_ratings cascades on delete):
--   DELETE FROM exercises WHERE slug IN (
--     'weighted-chest-dip',
--     'smith-machine-flat-bench-press',
--     'smith-machine-incline-bench-press',
--     'decline-dumbbell-press',
--     'low-to-high-cable-fly',
--     'high-to-low-cable-fly',
--     'single-arm-machine-chest-press',
--     'weighted-pull-up',
--     'weighted-chin-up',
--     'negative-pull-up',
--     'scapular-pull-up',
--     'single-arm-lat-pulldown',
--     'chest-supported-machine-row',
--     'high-cable-row',
--     'cable-pullover',
--     'machine-pullover',
--     'slow-tempo-push-up',
--     'paused-push-up',
--     'close-grip-push-up',
--     'spiderman-push-up',
--     'plank-to-push-up',
--     'table-inverted-row',
--     'towel-door-row',
--     'superman-lat-pull',
--     'towel-pullover',
--     'active-hang',
--     'slow-bodyweight-squat',
--     'paused-bodyweight-squat',
--     'bodyweight-sumo-squat',
--     'bodyweight-forward-lunge',
--     'bodyweight-reverse-lunge',
--     'bodyweight-bulgarian-split-squat',
--     'towel-hamstring-curl',
--     'chair-hip-thrust',
--     'long-lever-plank',
--     'plank-leg-lift',
--     'heel-touch-crunch',
--     'towel-biceps-curl',
--     'self-resisted-triceps-extension'
--   );
