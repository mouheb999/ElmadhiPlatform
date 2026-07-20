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
-- EXERCISES + PROGRAM TEMPLATES — REMOVED
-- =====================================================================
-- The 80 seed exercises were superseded by migration 019, which rebuilds
-- the catalog from exercise-specs/ (213 canonical rows). Re-inserting them
-- here would resurrect duplicates with no slug, tier or illustration.
--
-- program_templates / template_days / template_exercises were dropped in
-- migration 023 — running their INSERTs now fails outright. Program
-- generation reads split_definitions -> split_days -> split_day_slots.

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
