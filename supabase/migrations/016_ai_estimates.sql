-- 016_ai_estimates.sql
-- AI calorie calculator: text-described AI estimates get their own
-- entry_method ('ai_estimate') so analytics can tell them apart from photo
-- recognition ('camera_ai'). Re-runnable.

ALTER TABLE meal_logs DROP CONSTRAINT IF EXISTS meal_logs_entry_method_check;
ALTER TABLE meal_logs ADD CONSTRAINT meal_logs_entry_method_check
  CHECK (entry_method IN ('search', 'recent', 'favorite', 'copy_yesterday',
                          'quick', 'template', 'barcode', 'voice',
                          'camera_ai', 'ai_estimate'));
