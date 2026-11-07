import { pick, type Locale } from "@/lib/i18n";

/**
 * Display names for the meal slots a log can be filed under.
 *
 * Lifted out of the food diary so the Today screen can name the same slots
 * the same way. It had to be a plain module rather than an export of the
 * diary: the diary is a client component, and a constant imported from a
 * "use client" file into a server component arrives as a client reference,
 * not as data.
 *
 * The keys are exactly the slots the database constraint permits, plus the
 * legacy breakfast/lunch/dinner that days logged before the diary mirrored
 * the plan still carry.
 */
export const MEAL_SLOT_LABELS: Record<string, { en: string; ar: string }> = {
  meal_1: { en: "Meal 1", ar: "الوجبة 1" },
  snack: { en: "Snack", ar: "وجبة خفيفة" },
  meal_2: { en: "Meal 2", ar: "الوجبة 2" },
  meal_3: { en: "Meal 3", ar: "الوجبة 3" },
  pre_workout: { en: "Pre-workout", ar: "قبل التمرين" },
  post_workout: { en: "Post-workout", ar: "بعد التمرين" },
  last_meal: { en: "Last meal", ar: "آخر وجبة" },
  other: { en: "Other", ar: "أخرى" },
  // legacy slots, for days logged before the diary mirrored the plan
  breakfast: { en: "Breakfast", ar: "الفطور" },
  lunch: { en: "Lunch", ar: "الغداء" },
  dinner: { en: "Dinner", ar: "العشاء" },
};

/** The order a day is eaten in, for listing slots top to bottom. */
export const MEAL_SLOT_ORDER = [
  "breakfast",
  "meal_1",
  "snack",
  "lunch",
  "meal_2",
  "pre_workout",
  "post_workout",
  "dinner",
  "meal_3",
  "last_meal",
  "other",
];

export function mealSlotLabel(locale: Locale, key: string): string {
  const label = MEAL_SLOT_LABELS[key];
  return label ? pick(locale, label.en, label.ar) : key;
}
