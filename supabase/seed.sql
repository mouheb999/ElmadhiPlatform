-- seed.sql
-- Runs after schema migrations on a fresh DB. English + Tunisian Arabic only.
-- name_fr / question_fr columns intentionally left NULL.

-- =====================================================================
-- FOODS (50)
-- =====================================================================
INSERT INTO foods (name_ar, name_en, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, typical_serving_g, price_tnd_per_kg, price_tier, allergens, tags, is_common) VALUES
-- grains
('خبز أبيض','White Bread','grain',265,9.0,49.0,3.2,2.7,50,2.50,'low','{gluten}','{vegetarian,halal}',TRUE),
('سميد','Semolina','grain',360,12.0,73.0,1.0,3.9,80,2.20,'low','{gluten}','{vegetarian,halal}',TRUE),
('كسكسي','Couscous (dry)','grain',376,13.0,77.0,0.6,5.0,80,2.80,'low','{gluten}','{vegetarian,halal}',TRUE),
('أرز','Rice','grain',360,7.0,79.0,0.6,1.3,75,2.50,'low','{}','{vegetarian,halal}',TRUE),
('مقرونة','Pasta','grain',371,13.0,75.0,1.5,3.2,80,2.40,'low','{gluten}','{vegetarian,halal}',TRUE),
('شوفان','Oats','grain',389,16.9,66.3,6.9,10.6,40,5.00,'medium','{gluten}','{vegetarian,halal,high_protein}',FALSE),
('برغل','Bulgur','grain',342,12.3,75.9,1.3,18.3,70,3.50,'low','{gluten}','{vegetarian,halal}',FALSE),
('دقيق','Wheat Flour','grain',364,10.0,76.0,1.0,2.7,50,1.80,'low','{gluten}','{vegetarian,halal}',TRUE),
-- protein
('بيض','Egg','protein',155,13.0,1.1,11.0,0,50,8.00,'medium','{eggs}','{vegetarian,halal,high_protein}',TRUE),
('صدر دجاج','Chicken Breast','protein',165,31.0,0,3.6,0,150,12.00,'medium','{}','{halal,high_protein}',TRUE),
('لحم بقري','Beef','protein',250,26.0,0,17.0,0,150,30.00,'high','{}','{halal,high_protein}',FALSE),
('لحم غنمي','Lamb','protein',294,25.0,0,21.0,0,150,32.00,'high','{}','{halal,high_protein}',FALSE),
('تن','Tuna','protein',132,28.0,0,1.3,0,100,14.00,'medium','{}','{halal,high_protein,pescatarian}',TRUE),
('سردينة','Sardines','protein',208,25.0,0,11.0,0,100,6.00,'low','{}','{halal,high_protein,pescatarian}',TRUE),
('حوت أبيض','White Fish','protein',105,23.0,0,1.5,0,150,16.00,'medium','{}','{halal,high_protein,pescatarian}',FALSE),
('قمرون','Shrimp','protein',99,24.0,0.2,0.3,0,100,28.00,'high','{shellfish}','{halal,high_protein,pescatarian}',FALSE),
('حمص','Chickpeas','protein',164,8.9,27.4,2.6,7.6,80,4.00,'low','{}','{vegetarian,halal,high_protein}',TRUE),
('عدس','Lentils','protein',116,9.0,20.0,0.4,7.9,80,4.50,'low','{}','{vegetarian,halal,high_protein}',TRUE),
('فول','Fava Beans','protein',110,7.6,19.7,0.4,5.4,80,3.80,'low','{}','{vegetarian,halal,high_protein}',TRUE),
('كبدة','Liver','protein',135,20.0,3.9,4.9,0,120,9.00,'low','{}','{halal,high_protein}',FALSE),
-- dairy
('حليب','Milk','dairy',60,3.2,4.8,3.3,0,250,1.50,'low','{lactose}','{vegetarian,halal}',TRUE),
('ياغرت','Yogurt','dairy',61,3.5,4.7,3.3,0,125,3.00,'low','{lactose}','{vegetarian,halal}',TRUE),
('جبن','Cheese','dairy',350,25.0,1.3,28.0,0,40,18.00,'high','{lactose}','{vegetarian,halal,high_protein}',FALSE),
('ريكوتة','Ricotta','dairy',174,11.0,3.0,13.0,0,60,12.00,'medium','{lactose}','{vegetarian,halal}',FALSE),
('زبدة','Butter','dairy',717,0.9,0.1,81.0,0,15,16.00,'high','{lactose}','{vegetarian,halal}',FALSE),
('جبن قريش','Cottage Cheese','dairy',98,11.0,3.4,4.3,0,100,10.00,'medium','{lactose}','{vegetarian,halal,high_protein}',FALSE),
-- vegetable
('طماطم','Tomato','vegetable',18,0.9,3.9,0.2,1.2,120,1.50,'low','{}','{vegetarian,halal}',TRUE),
('بطاطا','Potato','vegetable',77,2.0,17.0,0.1,2.2,150,1.20,'low','{}','{vegetarian,halal}',TRUE),
('بصل','Onion','vegetable',40,1.1,9.3,0.1,1.7,80,1.00,'low','{}','{vegetarian,halal}',TRUE),
('فلفل','Pepper','vegetable',31,1.0,6.0,0.3,2.1,100,2.00,'low','{}','{vegetarian,halal}',TRUE),
('جزر','Carrot','vegetable',41,0.9,9.6,0.2,2.8,80,1.30,'low','{}','{vegetarian,halal}',TRUE),
('قرع','Pumpkin','vegetable',26,1.0,6.5,0.1,0.5,100,1.40,'low','{}','{vegetarian,halal}',FALSE),
('سبانخ','Spinach','vegetable',23,2.9,3.6,0.4,2.2,80,3.00,'low','{}','{vegetarian,halal}',FALSE),
('خيار','Cucumber','vegetable',15,0.7,3.6,0.1,0.5,120,1.80,'low','{}','{vegetarian,halal}',FALSE),
('كوسة','Zucchini','vegetable',17,1.2,3.1,0.3,1.0,120,1.60,'low','{}','{vegetarian,halal}',FALSE),
-- fruit
('تفاح','Apple','fruit',52,0.3,14.0,0.2,2.4,150,3.50,'low','{}','{vegetarian,halal}',TRUE),
('موز','Banana','fruit',89,1.1,23.0,0.3,2.6,120,3.80,'low','{}','{vegetarian,halal}',TRUE),
('برتقال','Orange','fruit',47,0.9,12.0,0.1,2.4,150,2.50,'low','{}','{vegetarian,halal}',TRUE),
('تمر','Dates','fruit',282,2.5,75.0,0.4,8.0,40,9.00,'medium','{}','{vegetarian,halal}',TRUE),
('رمان','Pomegranate','fruit',83,1.7,19.0,1.2,4.0,150,5.00,'medium','{}','{vegetarian,halal}',FALSE),
-- fat
('زيت زيتون','Olive Oil','fat',884,0,0,100.0,0,15,18.00,'high','{}','{vegetarian,halal}',TRUE),
('زيتون','Olives','fat',115,0.8,6.3,11.0,3.2,30,7.00,'medium','{}','{vegetarian,halal}',TRUE),
('لوز','Almonds','fat',579,21.0,22.0,50.0,12.5,30,22.00,'high','{nuts}','{vegetarian,halal,high_protein}',FALSE),
('طحينة','Tahini','fat',595,17.0,21.0,53.0,9.3,20,14.00,'medium','{nuts}','{vegetarian,halal}',FALSE),
-- prepared / snack / drink
('هريسة','Harissa','prepared',70,3.0,11.0,2.0,5.0,15,8.00,'low','{}','{vegetarian,halal}',TRUE),
('طون معلب','Canned Tuna in Oil','prepared',198,24.0,0,11.0,0,80,12.00,'medium','{}','{halal,high_protein,pescatarian}',TRUE),
('كاكاويا','Peanuts','snack',567,26.0,16.0,49.0,8.5,30,8.00,'low','{nuts}','{vegetarian,halal,high_protein}',FALSE),
('شكلاطة','Dark Chocolate','snack',546,5.0,61.0,31.0,7.0,25,20.00,'high','{lactose}','{vegetarian}',FALSE),
('عصير برتقال','Orange Juice','drink',45,0.7,10.4,0.2,0.2,200,3.50,'low','{}','{vegetarian,halal}',FALSE),
('قهوة','Coffee','drink',2,0.1,0,0,0,30,15.00,'medium','{}','{vegetarian,halal}',FALSE);

-- =====================================================================
-- RECIPES (exactly 10)
-- =====================================================================
INSERT INTO recipes (name_ar, name_en, category, typical_serving_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, price_tier, allergens, tags) VALUES
('كسكسي','Couscous','prepared',350,160,7.5,20.0,5.5,2.5,'medium','{gluten}','{halal}'),
('لبلابي','Lablabi','prepared',400,120,6.0,15.0,4.0,4.0,'low','{gluten}','{vegetarian,halal}'),
('عجة','Ojja','prepared',300,140,9.0,5.0,9.0,1.5,'low','{eggs}','{vegetarian,halal,high_protein}'),
('بريك','Brik','prepared',120,230,8.0,18.0,14.0,1.5,'low','{gluten,eggs}','{halal}'),
('ملوخية','Mloukhia','prepared',350,150,10.0,6.0,9.0,3.0,'medium','{}','{halal,high_protein}'),
('شربة','Shorba','prepared',300,90,4.5,12.0,2.5,1.5,'low','{gluten}','{halal}'),
('سلاطة مشوية','Salade Mechouia','prepared',200,80,2.0,7.0,5.0,2.5,'low','{}','{vegetarian,halal}'),
('كفتاجي','Kafteji','prepared',300,170,5.0,12.0,11.0,3.0,'low','{eggs}','{vegetarian,halal}'),
('سلاطة تونسية','Slata Tounsia','prepared',200,45,1.2,5.0,2.5,1.5,'low','{}','{vegetarian,halal}'),
('مقروض','Makroudh','snack',60,380,5.0,55.0,15.0,3.0,'medium','{gluten}','{vegetarian,halal}');

-- =====================================================================
-- RECIPE INGREDIENTS (3-5 per recipe)
-- =====================================================================
INSERT INTO recipe_ingredients (recipe_id, food_id, quantity_g, order_index) VALUES
-- Couscous
((SELECT id FROM recipes WHERE name_en='Couscous'),(SELECT id FROM foods WHERE name_en='Couscous (dry)'),120,1),
((SELECT id FROM recipes WHERE name_en='Couscous'),(SELECT id FROM foods WHERE name_en='Lamb'),100,2),
((SELECT id FROM recipes WHERE name_en='Couscous'),(SELECT id FROM foods WHERE name_en='Carrot'),60,3),
((SELECT id FROM recipes WHERE name_en='Couscous'),(SELECT id FROM foods WHERE name_en='Pumpkin'),60,4),
((SELECT id FROM recipes WHERE name_en='Couscous'),(SELECT id FROM foods WHERE name_en='Olive Oil'),15,5),
-- Lablabi
((SELECT id FROM recipes WHERE name_en='Lablabi'),(SELECT id FROM foods WHERE name_en='Chickpeas'),150,1),
((SELECT id FROM recipes WHERE name_en='Lablabi'),(SELECT id FROM foods WHERE name_en='White Bread'),80,2),
((SELECT id FROM recipes WHERE name_en='Lablabi'),(SELECT id FROM foods WHERE name_en='Egg'),50,3),
((SELECT id FROM recipes WHERE name_en='Lablabi'),(SELECT id FROM foods WHERE name_en='Harissa'),15,4),
((SELECT id FROM recipes WHERE name_en='Lablabi'),(SELECT id FROM foods WHERE name_en='Olive Oil'),15,5),
-- Ojja
((SELECT id FROM recipes WHERE name_en='Ojja'),(SELECT id FROM foods WHERE name_en='Egg'),100,1),
((SELECT id FROM recipes WHERE name_en='Ojja'),(SELECT id FROM foods WHERE name_en='Tomato'),120,2),
((SELECT id FROM recipes WHERE name_en='Ojja'),(SELECT id FROM foods WHERE name_en='Pepper'),60,3),
((SELECT id FROM recipes WHERE name_en='Ojja'),(SELECT id FROM foods WHERE name_en='Harissa'),15,4),
-- Brik
((SELECT id FROM recipes WHERE name_en='Brik'),(SELECT id FROM foods WHERE name_en='Egg'),50,1),
((SELECT id FROM recipes WHERE name_en='Brik'),(SELECT id FROM foods WHERE name_en='Potato'),80,2),
((SELECT id FROM recipes WHERE name_en='Brik'),(SELECT id FROM foods WHERE name_en='Canned Tuna in Oil'),50,3),
((SELECT id FROM recipes WHERE name_en='Brik'),(SELECT id FROM foods WHERE name_en='Wheat Flour'),40,4),
-- Mloukhia
((SELECT id FROM recipes WHERE name_en='Mloukhia'),(SELECT id FROM foods WHERE name_en='Beef'),120,1),
((SELECT id FROM recipes WHERE name_en='Mloukhia'),(SELECT id FROM foods WHERE name_en='Olive Oil'),20,2),
((SELECT id FROM recipes WHERE name_en='Mloukhia'),(SELECT id FROM foods WHERE name_en='Onion'),40,3),
((SELECT id FROM recipes WHERE name_en='Mloukhia'),(SELECT id FROM foods WHERE name_en='White Bread'),60,4),
-- Shorba
((SELECT id FROM recipes WHERE name_en='Shorba'),(SELECT id FROM foods WHERE name_en='Lamb'),80,1),
((SELECT id FROM recipes WHERE name_en='Shorba'),(SELECT id FROM foods WHERE name_en='Semolina'),40,2),
((SELECT id FROM recipes WHERE name_en='Shorba'),(SELECT id FROM foods WHERE name_en='Tomato'),80,3),
((SELECT id FROM recipes WHERE name_en='Shorba'),(SELECT id FROM foods WHERE name_en='Onion'),30,4),
-- Salade Mechouia
((SELECT id FROM recipes WHERE name_en='Salade Mechouia'),(SELECT id FROM foods WHERE name_en='Pepper'),120,1),
((SELECT id FROM recipes WHERE name_en='Salade Mechouia'),(SELECT id FROM foods WHERE name_en='Tomato'),100,2),
((SELECT id FROM recipes WHERE name_en='Salade Mechouia'),(SELECT id FROM foods WHERE name_en='Olive Oil'),20,3),
((SELECT id FROM recipes WHERE name_en='Salade Mechouia'),(SELECT id FROM foods WHERE name_en='Canned Tuna in Oil'),40,4),
-- Kafteji
((SELECT id FROM recipes WHERE name_en='Kafteji'),(SELECT id FROM foods WHERE name_en='Potato'),100,1),
((SELECT id FROM recipes WHERE name_en='Kafteji'),(SELECT id FROM foods WHERE name_en='Pepper'),60,2),
((SELECT id FROM recipes WHERE name_en='Kafteji'),(SELECT id FROM foods WHERE name_en='Zucchini'),60,3),
((SELECT id FROM recipes WHERE name_en='Kafteji'),(SELECT id FROM foods WHERE name_en='Egg'),50,4),
((SELECT id FROM recipes WHERE name_en='Kafteji'),(SELECT id FROM foods WHERE name_en='Olive Oil'),20,5),
-- Slata Tounsia
((SELECT id FROM recipes WHERE name_en='Slata Tounsia'),(SELECT id FROM foods WHERE name_en='Tomato'),100,1),
((SELECT id FROM recipes WHERE name_en='Slata Tounsia'),(SELECT id FROM foods WHERE name_en='Cucumber'),80,2),
((SELECT id FROM recipes WHERE name_en='Slata Tounsia'),(SELECT id FROM foods WHERE name_en='Onion'),30,3),
((SELECT id FROM recipes WHERE name_en='Slata Tounsia'),(SELECT id FROM foods WHERE name_en='Olive Oil'),15,4),
-- Makroudh
((SELECT id FROM recipes WHERE name_en='Makroudh'),(SELECT id FROM foods WHERE name_en='Semolina'),60,1),
((SELECT id FROM recipes WHERE name_en='Makroudh'),(SELECT id FROM foods WHERE name_en='Dates'),50,2),
((SELECT id FROM recipes WHERE name_en='Makroudh'),(SELECT id FROM foods WHERE name_en='Olive Oil'),20,3);

-- =====================================================================
-- EXERCISES (80) - all primary_muscle groups, equipment spread
-- =====================================================================
INSERT INTO exercises (name_en, name_ar, primary_muscle, secondary_muscles, equipment, movement_pattern, difficulty, contraindicated_for, video_url, instructions) VALUES
-- chest
('Barbell Bench Press','ضغط بار للصدر','chest','{triceps,shoulders}','barbell','push','intermediate','{shoulder}',NULL,'Lower the bar to mid-chest and press up.'),
('Incline Dumbbell Press','ضغط دمبل مائل','chest','{shoulders,triceps}','dumbbell','push','intermediate','{shoulder}',NULL,'Press dumbbells up on an incline bench.'),
('Push-Up','تمرين الضغط','chest','{triceps,core}','bodyweight','push','beginner','{wrist}',NULL,'Lower chest to floor, push back up.'),
('Dumbbell Fly','تفتيح بالدمبل','chest','{shoulders}','dumbbell','push','beginner','{shoulder}',NULL,'Open arms wide then squeeze chest.'),
('Cable Crossover','كروس أوفر كابل','chest','{shoulders}','cable','push','intermediate','{shoulder}',NULL,'Pull cables together in front of chest.'),
('Machine Chest Press','ضغط آلة الصدر','chest','{triceps}','machine','push','beginner','{shoulder}',NULL,'Press handles forward, control return.'),
('Decline Push-Up','ضغط منحدر','chest','{triceps,shoulders}','bodyweight','push','intermediate','{wrist}',NULL,'Feet elevated, lower chest, press up.'),
('Dumbbell Bench Press','ضغط دمبل مستوي','chest','{triceps,shoulders}','dumbbell','push','beginner','{shoulder}',NULL,'Press dumbbells from chest to lockout.'),
('Kettlebell Floor Press','ضغط كيتل بيل أرضي','chest','{triceps,shoulders}','kettlebell','push','beginner','{shoulder}',NULL,'Press kettlebell up from the floor.'),
-- back
('Deadlift','الرفعة الميتة','back','{hamstrings,glutes}','barbell','hinge','advanced','{lower_back}',NULL,'Hinge and lift the bar keeping back flat.'),
('Pull-Up','العقلة','back','{biceps,forearms}','bodyweight','pull','intermediate','{elbow}',NULL,'Pull chin over the bar, lower slowly.'),
('Bent-Over Barbell Row','تجديف بالبار','back','{biceps,core}','barbell','pull','intermediate','{lower_back}',NULL,'Row bar to lower ribs, squeeze back.'),
('Dumbbell Row','تجديف بالدمبل','back','{biceps}','dumbbell','pull','beginner','{lower_back}',NULL,'Row dumbbell to hip, brace on bench.'),
('Lat Pulldown','سحب علوي','back','{biceps}','cable','pull','beginner','{}',NULL,'Pull bar to upper chest, control up.'),
('Seated Cable Row','تجديف كابل جالس','back','{biceps}','cable','pull','beginner','{lower_back}',NULL,'Pull handle to torso, squeeze shoulder blades.'),
('Inverted Row','تجديف معكوس','back','{biceps,core}','bodyweight','pull','beginner','{}',NULL,'Pull chest to bar from under it.'),
('Machine Row','تجديف آلة','back','{biceps}','machine','pull','beginner','{}',NULL,'Pull handles back, squeeze.'),
('Kettlebell Swing','مرجحة كيتل بيل','back','{glutes,hamstrings}','kettlebell','hinge','intermediate','{lower_back}',NULL,'Hinge and swing bell to chest height.'),
-- shoulders
('Overhead Press','الضغط العلوي','shoulders','{triceps,core}','barbell','push','intermediate','{shoulder}',NULL,'Press bar overhead, lock out.'),
('Dumbbell Shoulder Press','ضغط أكتاف دمبل','shoulders','{triceps}','dumbbell','push','beginner','{shoulder}',NULL,'Press dumbbells overhead.'),
('Lateral Raise','رفع جانبي','shoulders','{}','dumbbell','push','beginner','{shoulder}',NULL,'Raise dumbbells to sides to shoulder height.'),
('Front Raise','رفع أمامي','shoulders','{}','dumbbell','push','beginner','{shoulder}',NULL,'Raise dumbbell to front, shoulder height.'),
('Face Pull','سحب للوجه','shoulders','{back}','cable','pull','beginner','{}',NULL,'Pull rope to face, elbows high.'),
('Pike Push-Up','ضغط هرمي','shoulders','{triceps}','bodyweight','push','intermediate','{shoulder,wrist}',NULL,'Hips high, lower head to floor.'),
('Arnold Press','ضغط أرنولد','shoulders','{triceps}','dumbbell','push','intermediate','{shoulder}',NULL,'Rotate and press dumbbells overhead.'),
('Band Lateral Raise','رفع جانبي مطاط','shoulders','{}','band','push','beginner','{shoulder}',NULL,'Raise band to sides to shoulder height.'),
('Machine Shoulder Press','ضغط أكتاف آلة','shoulders','{triceps}','machine','push','beginner','{shoulder}',NULL,'Press handles overhead on the machine.'),
-- quads
('Back Squat','القرفصاء الخلفي','quads','{glutes,core}','barbell','squat','intermediate','{knee,lower_back}',NULL,'Squat below parallel, drive up.'),
('Front Squat','قرفصاء أمامي','quads','{core,glutes}','barbell','squat','advanced','{knee}',NULL,'Bar on front delts, squat down.'),
('Goblet Squat','قرفصاء كأس','quads','{glutes}','dumbbell','squat','beginner','{knee}',NULL,'Hold dumbbell at chest, squat down.'),
('Leg Press','دفع الأرجل','quads','{glutes}','machine','squat','beginner','{knee}',NULL,'Press platform away, control return.'),
('Bodyweight Squat','قرفصاء بوزن الجسم','quads','{glutes}','bodyweight','squat','beginner','{knee}',NULL,'Squat to parallel, stand up.'),
('Walking Lunge','اندفاع المشي','quads','{glutes,hamstrings}','dumbbell','squat','beginner','{knee}',NULL,'Step forward into lunge, alternate.'),
('Bulgarian Split Squat','قرفصاء بلغاري','quads','{glutes}','dumbbell','squat','intermediate','{knee}',NULL,'Rear foot elevated, lunge down.'),
('Leg Extension','تمديد الساق','quads','{}','machine','squat','beginner','{knee}',NULL,'Extend knees against pad.'),
('Wall Sit','جلوس الحائط','quads','{glutes}','bodyweight',NULL,'beginner','{knee}',NULL,'Hold seated position against wall.'),
-- hamstrings
('Romanian Deadlift','الرفعة الرومانية','hamstrings','{glutes,back}','barbell','hinge','intermediate','{lower_back}',NULL,'Hinge with soft knees, feel hamstrings.'),
('Lying Leg Curl','ثني الساق منبطح','hamstrings','{}','machine','hinge','beginner','{}',NULL,'Curl heels toward glutes.'),
('Dumbbell RDL','رفعة رومانية دمبل','hamstrings','{glutes}','dumbbell','hinge','beginner','{lower_back}',NULL,'Hinge holding dumbbells along legs.'),
('Nordic Curl','ثني نوردي','hamstrings','{glutes}','bodyweight','hinge','advanced','{knee}',NULL,'Lower torso under control, hamstrings.'),
('Good Morning','صباح الخير','hamstrings','{glutes,back}','barbell','hinge','intermediate','{lower_back}',NULL,'Hinge with bar on back, return.'),
('Glute-Ham Raise','رفع الألوية','hamstrings','{glutes}','bodyweight','hinge','advanced','{knee}',NULL,'Lower and raise torso on pad.'),
('Cable Pull-Through','سحب كابل','hamstrings','{glutes}','cable','hinge','beginner','{lower_back}',NULL,'Hinge and pull cable through legs.'),
-- glutes
('Hip Thrust','دفع الورك','glutes','{hamstrings}','barbell','hinge','intermediate','{}',NULL,'Drive hips up, squeeze glutes.'),
('Glute Bridge','جسر الألوية','glutes','{hamstrings}','bodyweight','hinge','beginner','{}',NULL,'Lift hips off floor, squeeze.'),
('Cable Kickback','ركلة كابل','glutes','{hamstrings}','cable','hinge','beginner','{}',NULL,'Kick leg back against cable.'),
('Step-Up','الصعود','glutes','{quads,hamstrings}','dumbbell','squat','beginner','{knee}',NULL,'Step onto box, drive through heel.'),
('Banded Hip Abduction','تبعيد الورك مطاط','glutes','{}','band',NULL,'beginner','{}',NULL,'Push knees apart against band.'),
-- calves
('Standing Calf Raise','رفع السمانة واقف','calves','{}','machine',NULL,'beginner','{}',NULL,'Rise onto toes, lower slowly.'),
('Seated Calf Raise','رفع السمانة جالس','calves','{}','machine',NULL,'beginner','{}',NULL,'Raise heels seated against pad.'),
('Bodyweight Calf Raise','رفع السمانة بوزن الجسم','calves','{}','bodyweight',NULL,'beginner','{}',NULL,'Rise onto toes, control down.'),
('Dumbbell Calf Raise','رفع السمانة دمبل','calves','{}','dumbbell',NULL,'beginner','{}',NULL,'Hold dumbbells, rise onto toes.'),
-- biceps
('Barbell Curl','مرجحة بار','biceps','{forearms}','barbell','pull','beginner','{elbow}',NULL,'Curl bar up, control down.'),
('Dumbbell Curl','مرجحة دمبل','biceps','{forearms}','dumbbell','pull','beginner','{elbow}',NULL,'Curl dumbbells, squeeze biceps.'),
('Hammer Curl','مرجحة المطرقة','biceps','{forearms}','dumbbell','pull','beginner','{elbow}',NULL,'Curl with neutral grip.'),
('Cable Curl','مرجحة كابل','biceps','{forearms}','cable','pull','beginner','{elbow}',NULL,'Curl cable, control return.'),
('Chin-Up','عقلة قبضة عكسية','biceps','{back}','bodyweight','pull','intermediate','{elbow}',NULL,'Pull up with underhand grip.'),
('Band Curl','مرجحة مطاط','biceps','{forearms}','band','pull','beginner','{elbow}',NULL,'Curl band against resistance.'),
-- triceps
('Close-Grip Bench Press','ضغط قبضة ضيقة','triceps','{chest,shoulders}','barbell','push','intermediate','{elbow}',NULL,'Press with narrow grip.'),
('Triceps Pushdown','دفع الترايسبس','triceps','{}','cable','push','beginner','{elbow}',NULL,'Push rope down, extend elbows.'),
('Overhead Triceps Extension','تمديد علوي ترايسبس','triceps','{}','dumbbell','push','beginner','{elbow}',NULL,'Lower dumbbell behind head, extend.'),
('Bench Dip','غطس المقعد','triceps','{chest,shoulders}','bodyweight','push','beginner','{shoulder,elbow}',NULL,'Lower body off bench, press up.'),
('Diamond Push-Up','ضغط الماسة','triceps','{chest}','bodyweight','push','intermediate','{wrist,elbow}',NULL,'Hands together, lower and press.'),
('Band Pushdown','دفع مطاط','triceps','{}','band','push','beginner','{elbow}',NULL,'Push band down, extend elbows.'),
-- core
('Plank','البلانك','core','{shoulders}','bodyweight',NULL,'beginner','{lower_back}',NULL,'Hold straight body on forearms.'),
('Hanging Leg Raise','رفع الأرجل معلق','core','{}','bodyweight',NULL,'intermediate','{lower_back}',NULL,'Raise legs while hanging.'),
('Crunch','تقلص البطن','core','{}','bodyweight',NULL,'beginner','{}',NULL,'Curl shoulders toward pelvis.'),
('Russian Twist','الالتواء الروسي','core','{}','bodyweight','rotation','beginner','{lower_back}',NULL,'Rotate torso side to side.'),
('Cable Woodchop','قطع الخشب كابل','core','{shoulders}','cable','rotation','intermediate','{lower_back}',NULL,'Rotate pulling cable across body.'),
('Mountain Climber','متسلق الجبل','core','{shoulders}','bodyweight',NULL,'beginner','{wrist}',NULL,'Drive knees to chest in plank.'),
('Dead Bug','الحشرة الميتة','core','{}','bodyweight',NULL,'beginner','{}',NULL,'Extend opposite arm and leg.'),
('Ab Wheel Rollout','عجلة البطن','core','{shoulders}','bodyweight',NULL,'advanced','{lower_back}',NULL,'Roll out and return under control.'),
('Farmer Carry','حمل الفلاح','core','{forearms,back}','dumbbell','carry','beginner','{}',NULL,'Walk holding heavy dumbbells.'),
('Side Plank','بلانك جانبي','core','{glutes}','bodyweight',NULL,'beginner','{}',NULL,'Hold body sideways on one forearm.'),
-- forearms
('Wrist Curl','مرجحة الرسغ','forearms','{}','dumbbell','pull','beginner','{wrist}',NULL,'Curl wrist up, control down.'),
('Reverse Wrist Curl','مرجحة رسغ عكسية','forearms','{}','dumbbell','pull','beginner','{wrist}',NULL,'Extend wrist against resistance.'),
('Dead Hang','تعليق','forearms','{back}','bodyweight',NULL,'beginner','{shoulder}',NULL,'Hang from bar for time.'),
('Barbell Wrist Curl','مرجحة رسغ بار','forearms','{}','barbell','pull','beginner','{wrist}',NULL,'Curl wrists with bar.'),
('Cable Reverse Curl','مرجحة عكسية كابل','forearms','{biceps}','cable','pull','beginner','{elbow}',NULL,'Curl with overhand grip.'),
('Plate Pinch','قبض الأقراص','forearms','{}','bodyweight','carry','intermediate','{}',NULL,'Pinch and hold weight plates.');

-- =====================================================================
-- PROGRAM TEMPLATES (exactly 6)
-- =====================================================================
INSERT INTO program_templates (name, split_type, days_per_week, goal, experience, equipment_required, description, rationale_template) VALUES
('Beginner Full Body Gym','full_body',3,'build_muscle','beginner','full_gym','3-day full body for gym beginners.','{"why_this_split":"Full body 3x/week maximizes practice and frequency for beginners.","why_this_volume":"Moderate sets allow recovery while learning technique.","why_these_exercises":"Compound barbell and machine lifts build a strength base."}'),
('Beginner Full Body Home','full_body',3,'general_fitness','beginner','bodyweight','3-day bodyweight full body, no equipment.','{"why_this_split":"Full body 3x/week fits limited home time.","why_this_volume":"Bodyweight volume scales with reps for beginners.","why_these_exercises":"Bodyweight movements need zero equipment."}'),
('Upper Lower Gym','upper_lower',4,'build_muscle','intermediate','full_gym','4-day upper/lower split for the gym.','{"why_this_split":"Upper/lower allows higher per-muscle frequency.","why_this_volume":"Two sessions per region balance volume and recovery.","why_these_exercises":"Mix of barbell, dumbbell and cable for hypertrophy."}'),
('Push Pull Legs Gym','ppl',6,'build_muscle','intermediate','full_gym','6-day PPL for committed lifters.','{"why_this_split":"PPL groups synergistic muscles for high volume.","why_this_volume":"Six days spread volume across the week.","why_these_exercises":"Dedicated push, pull and leg movements per day."}'),
('Upper Lower Home Basic','upper_lower',4,'build_muscle','intermediate','home_basic','4-day upper/lower with dumbbells and bands.','{"why_this_split":"Upper/lower works well with limited home gear.","why_this_volume":"Higher reps compensate for lighter loads.","why_these_exercises":"Dumbbell and band exercises suit a home gym."}'),
('Full Body Home Basic','full_body',3,'general_fitness','intermediate','home_basic','3-day full body with dumbbells and bands.','{"why_this_split":"Full body 3x/week for general fitness at home.","why_this_volume":"Balanced volume across all major muscles.","why_these_exercises":"Dumbbell and bodyweight basics for home training."}');

-- =====================================================================
-- TEMPLATE DAYS
-- =====================================================================
INSERT INTO template_days (template_id, day_number, day_name) VALUES
((SELECT id FROM program_templates WHERE name='Beginner Full Body Gym'),1,'Full Body A'),
((SELECT id FROM program_templates WHERE name='Beginner Full Body Gym'),2,'Full Body B'),
((SELECT id FROM program_templates WHERE name='Beginner Full Body Gym'),3,'Full Body C'),
((SELECT id FROM program_templates WHERE name='Beginner Full Body Home'),1,'Full Body A'),
((SELECT id FROM program_templates WHERE name='Beginner Full Body Home'),2,'Full Body B'),
((SELECT id FROM program_templates WHERE name='Beginner Full Body Home'),3,'Full Body C'),
((SELECT id FROM program_templates WHERE name='Upper Lower Gym'),1,'Upper A'),
((SELECT id FROM program_templates WHERE name='Upper Lower Gym'),2,'Lower A'),
((SELECT id FROM program_templates WHERE name='Upper Lower Gym'),3,'Upper B'),
((SELECT id FROM program_templates WHERE name='Upper Lower Gym'),4,'Lower B'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),1,'Push A'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),2,'Pull A'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),3,'Legs A'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),4,'Push B'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),5,'Pull B'),
((SELECT id FROM program_templates WHERE name='Push Pull Legs Gym'),6,'Legs B'),
((SELECT id FROM program_templates WHERE name='Upper Lower Home Basic'),1,'Upper A'),
((SELECT id FROM program_templates WHERE name='Upper Lower Home Basic'),2,'Lower A'),
((SELECT id FROM program_templates WHERE name='Upper Lower Home Basic'),3,'Upper B'),
((SELECT id FROM program_templates WHERE name='Upper Lower Home Basic'),4,'Lower B'),
((SELECT id FROM program_templates WHERE name='Full Body Home Basic'),1,'Full Body A'),
((SELECT id FROM program_templates WHERE name='Full Body Home Basic'),2,'Full Body B'),
((SELECT id FROM program_templates WHERE name='Full Body Home Basic'),3,'Full Body C');

-- =====================================================================
-- TEMPLATE EXERCISES (4-6 per day, equipment-compatible)
-- =====================================================================
-- Beginner Full Body Gym (full_gym - anything)
INSERT INTO template_exercises (template_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes) VALUES
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Back Squat'),1,3,'8-12',120,'Start light, focus on form.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Barbell Bench Press'),2,3,'8-12',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Lat Pulldown'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Shoulder Press'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Plank'),5,3,'8-12',60,'Hold 30-45s.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Romanian Deadlift'),1,3,'8-12',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Incline Dumbbell Press'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Seated Cable Row'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Leg Press'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Dumbbell Curl'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Goblet Squat'),1,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Machine Chest Press'),2,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Machine Row'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Lateral Raise'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Triceps Pushdown'),5,3,'12-15',60,NULL),
-- Beginner Full Body Home (bodyweight only)
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Bodyweight Squat'),1,3,'12-15',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Push-Up'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Inverted Row'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Glute Bridge'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Plank'),5,3,'8-12',60,'Hold 30s.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Bodyweight Squat'),1,3,'12-15',90,'Bodyweight only.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Decline Push-Up'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Pull-Up'),3,3,'6-10',90,'Assist if needed.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Pike Push-Up'),4,3,'8-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Side Plank'),5,3,'8-12',60,'Each side.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Wall Sit'),1,3,'8-12',90,'Hold 45s.'),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Diamond Push-Up'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Chin-Up'),3,3,'6-10',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Bodyweight Calf Raise'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Beginner Full Body Home' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Crunch'),5,3,'12-15',60,NULL),
-- Upper Lower Gym (full_gym)
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Barbell Bench Press'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Bent-Over Barbell Row'),2,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Overhead Press'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Lat Pulldown'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Barbell Curl'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Back Squat'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Romanian Deadlift'),2,3,'8-12',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Leg Press'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Lying Leg Curl'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Standing Calf Raise'),5,4,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Incline Dumbbell Press'),1,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Seated Cable Row'),2,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Lateral Raise'),3,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Face Pull'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Triceps Pushdown'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Front Squat'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Hip Thrust'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Bulgarian Split Squat'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Leg Extension'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Seated Calf Raise'),5,4,'12-15',60,NULL),
-- Push Pull Legs Gym (full_gym)
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Barbell Bench Press'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Overhead Press'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Incline Dumbbell Press'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Lateral Raise'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Triceps Pushdown'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Deadlift'),1,3,'5-8',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Pull-Up'),2,4,'6-10',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Bent-Over Barbell Row'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Face Pull'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Barbell Curl'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Back Squat'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Romanian Deadlift'),2,3,'8-12',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Leg Press'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Lying Leg Curl'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Standing Calf Raise'),5,4,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Dumbbell Bench Press'),1,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Dumbbell Shoulder Press'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Cable Crossover'),3,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Front Raise'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Overhead Triceps Extension'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=5),(SELECT id FROM exercises WHERE name_en='Lat Pulldown'),1,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=5),(SELECT id FROM exercises WHERE name_en='Seated Cable Row'),2,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=5),(SELECT id FROM exercises WHERE name_en='Dumbbell Row'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=5),(SELECT id FROM exercises WHERE name_en='Hammer Curl'),4,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=5),(SELECT id FROM exercises WHERE name_en='Cable Curl'),5,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=6),(SELECT id FROM exercises WHERE name_en='Front Squat'),1,4,'6-10',120,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=6),(SELECT id FROM exercises WHERE name_en='Hip Thrust'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=6),(SELECT id FROM exercises WHERE name_en='Walking Lunge'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=6),(SELECT id FROM exercises WHERE name_en='Leg Extension'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Push Pull Legs Gym' AND td.day_number=6),(SELECT id FROM exercises WHERE name_en='Seated Calf Raise'),5,4,'12-15',60,NULL),
-- Upper Lower Home Basic (dumbbell/bodyweight/band)
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Bench Press'),1,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Row'),2,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Shoulder Press'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Curl'),4,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Bench Dip'),5,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Goblet Squat'),1,4,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Dumbbell RDL'),2,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Bulgarian Split Squat'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Dumbbell Calf Raise'),4,4,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Plank'),5,3,'8-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Incline Dumbbell Press'),1,4,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Pull-Up'),2,3,'6-10',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Band Lateral Raise'),3,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Hammer Curl'),4,3,'10-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Band Pushdown'),5,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Walking Lunge'),1,4,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Dumbbell RDL'),2,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Step-Up'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Banded Hip Abduction'),4,3,'15-20',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Upper Lower Home Basic' AND td.day_number=4),(SELECT id FROM exercises WHERE name_en='Russian Twist'),5,3,'12-15',60,NULL),
-- Full Body Home Basic (dumbbell/bodyweight/band)
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Goblet Squat'),1,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Push-Up'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Dumbbell Row'),3,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Glute Bridge'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=1),(SELECT id FROM exercises WHERE name_en='Plank'),5,3,'8-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Dumbbell RDL'),1,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Dumbbell Shoulder Press'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Inverted Row'),3,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Walking Lunge'),4,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=2),(SELECT id FROM exercises WHERE name_en='Side Plank'),5,3,'8-12',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Bulgarian Split Squat'),1,3,'10-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Incline Dumbbell Press'),2,3,'8-12',90,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Band Curl'),3,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Dumbbell Calf Raise'),4,3,'12-15',60,NULL),
((SELECT td.id FROM template_days td JOIN program_templates pt ON pt.id=td.template_id WHERE pt.name='Full Body Home Basic' AND td.day_number=3),(SELECT id FROM exercises WHERE name_en='Crunch'),5,3,'12-15',60,NULL);

-- =====================================================================
-- QA CATEGORIES (4)
-- =====================================================================
INSERT INTO qa_categories (slug, name_en, name_ar, order_index) VALUES
('nutrition','Nutrition','التغذية',1),
('training','Training','التمرين',2),
('recovery','Recovery','الراحة',3),
('mindset','Mindset','العقلية',4);

-- =====================================================================
-- QA CARDS (15)
-- =====================================================================
INSERT INTO qa_cards (category_id, question_en, question_ar, answer_short, answer_long_md, answer_short_ar, answer_long_md_ar, visual_type, visual_data, scientific_sources, order_index, is_published) VALUES
-- nutrition
((SELECT id FROM qa_categories WHERE slug='nutrition'),'How much protein do I need per day?','قداش من البروتين نحتاج في النهار؟','Aim for about 1.6 to 2.2 grams of protein per kilogram of bodyweight daily.','Protein helps you build and keep muscle.\n\nMost active people do well with **1.6-2.2 g/kg** per day.\n\nSpread it across your meals for best results.','اهدف لحوالي 1.6 حتى 2.2 غرام بروتين لكل كيلو من وزنك في النهار.','البروتين يعاونك تبني وتحافظ على العضلات.\n\nأغلب الناس النشيطين يلزمهم **1.6-2.2 غ/كغ** في النهار.\n\nوزعو على وجباتك باش تاخو نتيجة أحسن.','illustration',NULL,'[]'::jsonb,1,TRUE),
((SELECT id FROM qa_categories WHERE slug='nutrition'),'Do I need supplements to build muscle?','نحتاج مكملات باش نبني عضلات؟','No, whole foods cover most needs; supplements are optional extras.','You can build muscle with real food alone.\n\nA balanced diet with enough protein and calories matters most.\n\nSupplements like whey or creatine are convenient but not required.','لا، الماكلة الطبيعية تكفي أغلب حاجتك؛ المكملات اختيارية برك.','تنجم تبني عضلات بالماكلة الطبيعية وحدها.\n\nنظام متوازن فيه بروتين وسعرات بركة هو الأهم.\n\nالمكملات كيف الواي أو الكرياتين مريحة أما موش ضرورية.','none',NULL,'[]'::jsonb,2,TRUE),
((SELECT id FROM qa_categories WHERE slug='nutrition'),'Are carbs bad for fat loss?','الكربوهيدرات مضرة للتنحيف؟','No, fat loss comes from a calorie deficit, not from cutting carbs.','Carbs are not the enemy.\n\nYou lose fat when you **eat fewer calories than you burn**.\n\nCarbs fuel your workouts, so keep some in your diet.','لا، التنحيف يجي من نقص السعرات، موش من تنحية الكربوهيدرات.','الكربوهيدرات موش العدو.\n\nتنحف كي **تاكل سعرات أقل من اللي تحرق**.\n\nالكربوهيدرات تعطيك طاقة للتمرين، خليها في نظامك.','comparison',NULL,'[]'::jsonb,3,TRUE),
((SELECT id FROM qa_categories WHERE slug='nutrition'),'How many meals should I eat per day?','قداش من وجبة نلزمني ناكل في النهار؟','Eat the number of meals that fits your routine; total daily intake matters most.','Meal frequency is mostly personal preference.\n\nWhether you eat 3 or 5 meals, your **daily totals** drive results.\n\nPick a schedule you can stick to.','كول عدد الوجبات اللي يناسب روتينك؛ المجموع اليومي هو الأهم.','عدد الوجبات أغلبه تفضيل شخصي.\n\nسواء كليت 3 ولا 5 وجبات، **المجموع اليومي** هو اللي يحدد النتيجة.\n\nاختار برنامج تنجم تكمل عليه.','none',NULL,'[]'::jsonb,4,TRUE),
((SELECT id FROM qa_categories WHERE slug='nutrition'),'Is breakfast the most important meal?','الفطور أهم وجبة؟','No single meal is magic; what matters is your total daily nutrition.','Breakfast is not magical.\n\nSome people perform fine training fasted, others need food first.\n\nFocus on **total daily protein and calories**, not one meal.','حتى وجبة موش سحرية؛ المهم هو تغذيتك اليومية الكاملة.','الفطور موش سحري.\n\nفمة ناس يتمرنو مليح وهوما صايمين، وأخرين يلزمهم ياكلو قبل.\n\nركز على **البروتين والسعرات اليومية**، موش وجبة وحدة.','none',NULL,'[]'::jsonb,5,TRUE),
-- training
((SELECT id FROM qa_categories WHERE slug='training'),'How often should a beginner train?','قداش يلزم المبتدئ يتمرن؟','Three full-body sessions per week is ideal for most beginners.','Beginners grow well on **3 days a week**.\n\nFull-body workouts hit each muscle often enough to progress.\n\nRest days let you recover and come back stronger.','ثلاث حصص فول بودي في الجمعة مثالية لأغلب المبتدئين.','المبتدئين يتطورو مليح بـ**3 أيام في الجمعة**.\n\nتمارين الفول بودي تضرب كل عضلة بقدر كافي للتقدم.\n\nأيام الراحة تخليك تتعافى وترجع أقوى.','illustration',NULL,'[]'::jsonb,6,TRUE),
((SELECT id FROM qa_categories WHERE slug='training'),'How long should my workout be?','قداش تطول حصة التمرين؟','Most effective sessions last about 45 to 75 minutes.','Quality beats length.\n\nA focused **45-75 minute** session is plenty for most goals.\n\nLong workouts often mean too much rest between sets.','أغلب الحصص الفعالة تدوم حوالي 45 حتى 75 دقيقة.','الجودة أهم من الطول.\n\nحصة مركزة **45-75 دقيقة** تكفي لأغلب الأهداف.\n\nالتمارين الطويلة أغلب الوقت معناها راحة برشة بين المجموعات.','none',NULL,'[]'::jsonb,7,TRUE),
((SELECT id FROM qa_categories WHERE slug='training'),'What is progressive overload?','شنوة الحمل التدريجي؟','Gradually adding weight, reps, or sets over time to keep making progress.','Progressive overload means **doing a bit more over time**.\n\nAdd weight, reps, or sets as you get stronger.\n\nThis steady challenge is what drives muscle growth.','زيادة الوزن ولا التكرارات ولا المجموعات بالتدريج باش تكمل تتقدم.','الحمل التدريجي معناه **تدير شوية أكثر مع الوقت**.\n\nزيد وزن ولا تكرارات ولا مجموعات كي تولي أقوى.\n\nهذا التحدي المستمر هو اللي يبني العضلات.','chart',NULL,'[]'::jsonb,8,TRUE),
((SELECT id FROM qa_categories WHERE slug='training'),'Should I do cardio and weights together?','نعمل كارديو ووزن في نفس الوقت؟','Yes, you can combine both; do weights first if strength is your priority.','Cardio and lifting work well together.\n\nIf building strength matters most, **lift first** while fresh.\n\nDo cardio after or on separate days.','إيه، تنجم تجمع الزوز؛ ابدا بالوزن كان القوة هي الأولوية.','الكارديو والوزن يخدمو مليح مع بعضهم.\n\nكان القوة هي الأهم، **ابدا بالوزن** وانت مرتاح.\n\nاعمل الكارديو من بعد ولا في أيام منفصلة.','none',NULL,'[]'::jsonb,9,TRUE),
((SELECT id FROM qa_categories WHERE slug='training'),'How do I know if I am lifting heavy enough?','كيفاش نعرف كان الوزن ثقيل بركة؟','The last few reps of each set should feel challenging but doable with good form.','Your weight is right when the **final reps feel hard**.\n\nLeave one or two reps in the tank with clean form.\n\nIf every rep feels easy, add weight.','آخر تكرارات في كل مجموعة لازم تحس بيهم صعاب أما تنجم تكملهم بفورمة مليحة.','الوزن متاعك صحيح كي **آخر التكرارات تحس بيهم صعاب**.\n\nخلي تكرار ولا زوز في الاحتياط بفورمة نظيفة.\n\nكان كل تكرار ساهل، زيد وزن.','none',NULL,'[]'::jsonb,10,TRUE),
-- recovery
((SELECT id FROM qa_categories WHERE slug='recovery'),'How much sleep do I need to recover?','قداش من النوم نحتاج باش نتعافى؟','Aim for seven to nine hours of quality sleep each night.','Sleep is when your body repairs and grows.\n\nMost people need **7-9 hours** for full recovery.\n\nPoor sleep slows progress and raises injury risk.','اهدف لـ7 حتى 9 سوايع من النوم المريح كل ليلة.','النوم هو الوقت اللي جسمك يصلح ويكبر فيه.\n\nأغلب الناس يحتاجو **7-9 سوايع** للتعافي الكامل.\n\nالنوم القليل يبطئ التقدم ويزيد خطر الإصابة.','illustration',NULL,'[]'::jsonb,11,TRUE),
((SELECT id FROM qa_categories WHERE slug='recovery'),'Are rest days really necessary?','أيام الراحة ضرورية فعلا؟','Yes, muscles grow during rest, not during the workout itself.','Rest days are part of training, not a break from it.\n\nMuscle repairs and grows **between sessions**.\n\nSkipping rest leads to fatigue and stalled progress.','إيه، العضلات تكبر في الراحة، موش في التمرين روحو.','أيام الراحة جزء من التدريب، موش بطلان منو.\n\nالعضلة تتصلح وتكبر **بين الحصص**.\n\nكان تفوت الراحة توصل للتعب وتوقف التقدم.','none',NULL,'[]'::jsonb,12,TRUE),
((SELECT id FROM qa_categories WHERE slug='recovery'),'Why am I so sore after working out?','علاش نحس بوجع برشة بعد التمرين؟','Muscle soreness is normal after new or harder training and fades in a few days.','Soreness, called DOMS, is normal.\n\nIt shows up after **new or harder workouts** and eases in 2-3 days.\n\nLight movement and good sleep help it pass.','وجع العضلات عادي بعد تمرين جديد ولا أصعب ويروح في كم نهار.','الوجع، اسمو DOMS، عادي.\n\nيجي بعد **تمارين جديدة ولا أصعب** ويخف في 2-3 أيام.\n\nالحركة الخفيفة والنوم المليح يعاونو يفوت.','none',NULL,'[]'::jsonb,13,TRUE),
-- mindset
((SELECT id FROM qa_categories WHERE slug='mindset'),'How long until I see results?','قداش من وقت باش نشوف نتائج؟','Expect noticeable changes in about eight to twelve weeks of consistent effort.','Real change takes time and consistency.\n\nMost people see clear progress after **8-12 weeks**.\n\nTrust the process and track small wins along the way.','استنى تغييرات واضحة في حوالي 8 حتى 12 جمعة من المجهود المستمر.','التغيير الحقيقي يحتاج وقت واستمرارية.\n\nأغلب الناس يشوفو تقدم واضح بعد **8-12 جمعة**.\n\nاثق في المسار وسجل الانتصارات الصغيرة في الطريق.','chart',NULL,'[]'::jsonb,14,TRUE),
((SELECT id FROM qa_categories WHERE slug='mindset'),'How do I stay motivated to keep training?','كيفاش نبقى متحمس باش نكمل نتمرن؟','Build small habits and track progress; consistency beats motivation.','Motivation comes and goes, so rely on habits.\n\nSet **small, clear goals** and log your workouts.\n\nSeeing progress keeps you coming back.','ابني عادات صغيرة وسجل تقدمك؛ الاستمرارية تغلب الحماس.','الحماس يجي ويمشي، اعتمد على العادات.\n\nحدد **أهداف صغيرة وواضحة** وسجل تمارينك.\n\nكي تشوف التقدم تكمل ترجع.','none',NULL,'[]'::jsonb,15,TRUE);
