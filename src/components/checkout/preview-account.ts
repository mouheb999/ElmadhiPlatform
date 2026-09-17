import type { TodayWorkoutDay } from "@/components/dashboard/today-workout";
import type { QaSparkCard } from "@/components/dashboard/qa-spark";
import type { QaCardData } from "@/components/qa/qa-card";
import type { EditorItem } from "@/components/diet/meal-card";
import type { IngredientOption } from "@/components/diet/ingredient-picker";
import type { MacroTotals } from "@/lib/algorithms/nutrition-feedback";

/**
 * The sample account behind the checkout preview — in the shapes the real
 * screens take.
 *
 * This file exists because of a gap between what the preview claimed and what
 * it was. Its own comment said "these are not pictures of the app, they are the
 * app's screens with a sample account behind them", and that was not true: the
 * screens were a second implementation, with their own card, their own donut
 * ("the donut from MacroRing", copied), their own button. Two implementations
 * of one screen drift, and the one nobody uses drifts fastest — so the thing a
 * stranger judged the product by was slowly becoming a worse version of it.
 *
 * So the preview now renders the real components — `TodayWorkout`,
 * `CheckinCard`, `ProgressTeaser`, `NutritionLiveTile`, `QaSpark`, `MacroRing`,
 * `MealCard`, `QaCard` — and this is what it feeds them. Every type below is
 * imported from the component that consumes it, so a change to any of those
 * props is a compile error here rather than a preview that quietly rots.
 *
 * The numbers are one plausible person's: a 78 kg man on a cut, three sessions
 * a week, six weeks in. Deliberately not a best case — a preview that shows a
 * transformation nobody gets is the same lie as a fake testimonial, and it is
 * the one a sceptical reader is best at spotting.
 *
 * Names carry both languages, the way the real rows do (`name_en` / `name_ar`),
 * rather than going through the string catalogue — the components call `pick()`
 * on them exactly as they do for a database row.
 */

/** Today's session, as `user_program_days` yields it. */
export const SAMPLE_DAY: TodayWorkoutDay = {
  id: "preview-day",
  name: "Push A",
  exerciseCount: 5,
};

/** The day's targets, from `macro_targets`. */
export const SAMPLE_TARGET: MacroTotals = {
  calories: 2150,
  proteinG: 154,
  carbsG: 212,
  fatG: 70,
};

/**
 * Fourteen mornings of weight, oldest first — what `ProgressTeaser` draws.
 *
 * It wanders. A clean line down would look better and be a lie about how
 * weight behaves; the flat stretch in the middle is the part a reader who has
 * dieted will recognise, and recognising something is what makes the rest of
 * the screen credible.
 */
export const SAMPLE_WEIGHTS = [
  80.4, 80.1, 80.2, 79.7, 79.9, 79.5, 79.3, 79.4, 79.1, 78.9, 79.0, 78.6, 78.5, 78.4,
];

export const SAMPLE_WEEK = { done: 2, target: 3 };
export const SAMPLE_STREAK = 5;

/** What the check-in card opens with: yesterday's weight, today still empty. */
export const SAMPLE_LAST_WEIGHT = 78.4;

/**
 * Three real questions from the library, in the shape `/qa` hands its cards.
 *
 * `categorySlug` is what picks the icon, so these carry the same slugs the
 * real categories use and the preview gets the real iconography for free.
 */
export const SAMPLE_QA: QaCardData[] = [
  {
    id: "preview-qa-1",
    categorySlug: "training",
    questionEn: "Should I train if I'm still sore?",
    questionAr: "هل أتمرّن وأنا ما زلت أشعر بألم؟",
    answerShort:
      "Mild soreness is fine — train. Sharp pain in a joint is not; move that muscle later in the week.",
    answerShortAr:
      "الألم الخفيف عادي — تمرّن. أما الألم الحادّ في مفصل فلا؛ أجّل تلك العضلة إلى آخر الأسبوع.",
  },
  {
    id: "preview-qa-2",
    categorySlug: "nutrition",
    questionEn: "Do I have to eat exactly what the plan says?",
    questionAr: "هل يجب أن آكل بالضبط ما في البرنامج؟",
    answerShort:
      "No. Hit your protein and stay near the calories — swap anything else for what you actually have at home.",
    answerShortAr:
      "لا. أكمل البروتين وابقَ قريباً من السعرات — وبدّل أي شيء آخر بما تجده في البيت.",
  },
  {
    id: "preview-qa-3",
    categorySlug: "recovery",
    questionEn: "How fast should I be losing weight?",
    questionAr: "بأي سرعة يجب أن أنقص؟",
    answerShort:
      "About 0.5–1% of your bodyweight a week. Faster than that and you start giving back muscle.",
    answerShortAr:
      "حوالي 0.5 إلى 1% من وزنك في الأسبوع. أسرع من ذلك وتبدأ بخسارة العضل.",
  },
];

/** The same three, in the shape the dashboard's shuffle card wants. */
export const SAMPLE_QA_SPARK: QaSparkCard[] = SAMPLE_QA.map((card) => ({
  id: card.id,
  questionEn: card.questionEn,
  questionAr: card.questionAr,
  answerShort: card.answerShort,
  answerShortAr: card.answerShortAr,
}));

/** A food as `nutrition_ingredients` holds it, portioned into a meal. */
function food(
  id: string,
  nameEn: string,
  nameAr: string,
  slot: string,
  quantityG: number,
  per100: [number, number, number, number],
  unit?: Partial<IngredientOption>,
): EditorItem {
  const [calories, protein, carbs, fat] = per100;
  return {
    id: `${id}-item`,
    foodRef: id,
    nameEn,
    nameAr,
    slot,
    quantityG,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
    imageUrl: null,
    unitEn: unit?.unitEn ?? null,
    unitEnPlural: unit?.unitEnPlural ?? null,
    unitAr: unit?.unitAr ?? null,
    unitArPlural: unit?.unitArPlural ?? null,
    unitGrams: unit?.unitGrams ?? null,
  };
}

const EGG = { unitEn: "egg", unitEnPlural: "eggs", unitAr: "بيضة", unitArPlural: "بيضات", unitGrams: 50 };

/**
 * The day's plan, meal by meal — Tunisian food in Tunisian portions.
 *
 * Breakfast and lunch are the ones already eaten, so the ring has somewhere to
 * move when the reader logs dinner. That is the single interaction the whole
 * preview is built around: their tap changes a number they were just looking
 * at.
 */
export const SAMPLE_MEALS: { slot: string; items: EditorItem[] }[] = [
  {
    slot: "breakfast",
    items: [
      food("eggs", "Eggs", "بيض", "protein", 100, [156, 13, 1, 11], EGG),
      food("bread", "Bread", "خبز", "carb", 80, [265, 9, 49, 3]),
      food("olive-oil", "Olive oil", "زيت زيتون", "fat", 10, [884, 0, 0, 100]),
    ],
  },
  {
    slot: "lunch",
    items: [
      food("chicken", "Chicken breast", "صدر دجاج", "protein", 180, [165, 31, 0, 4]),
      food("rice", "White rice", "أرز أبيض", "carb", 200, [130, 3, 28, 0]),
      food("salad", "Mixed salad", "سلطة مشكّلة", "vegetable", 150, [35, 2, 6, 0]),
    ],
  },
  {
    slot: "dinner",
    items: [
      food("tuna", "Tuna", "تونة", "protein", 120, [130, 29, 0, 1]),
      food("couscous", "Couscous", "كسكسي", "carb", 180, [176, 6, 36, 0]),
      food("vegetables", "Vegetables", "خضار", "vegetable", 200, [40, 2, 8, 0]),
    ],
  },
  {
    slot: "snack",
    items: [
      food("yoghurt", "Yoghurt", "ياغورت", "protein", 150, [80, 7, 8, 2]),
      food("almonds", "Almonds", "لوز", "fat", 30, [579, 21, 22, 50]),
    ],
  },
];

/** Which meals start already eaten. */
export const SAMPLE_EATEN = ["breakfast", "lunch"];

/**
 * What the "add a food" picker offers inside the preview.
 *
 * A short list rather than the real 77-row catalogue: the point of the screen
 * is that adding a food moves the ring, and a search box with everything in it
 * turns that into a shopping trip.
 */
export const SAMPLE_INGREDIENTS: IngredientOption[] = [
  { id: "eggs", nameEn: "Eggs", nameAr: "بيض", slot: "protein", caloriesPer100g: 156, proteinPer100g: 13, carbsPer100g: 1, fatPer100g: 11, imageUrl: null, breakfastOk: true, isOwn: false, ...EGG },
  { id: "chicken", nameEn: "Chicken breast", nameAr: "صدر دجاج", slot: "protein", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 4, imageUrl: null, breakfastOk: false, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "tuna", nameEn: "Tuna", nameAr: "تونة", slot: "protein", caloriesPer100g: 130, proteinPer100g: 29, carbsPer100g: 0, fatPer100g: 1, imageUrl: null, breakfastOk: true, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "bread", nameEn: "Bread", nameAr: "خبز", slot: "carb", caloriesPer100g: 265, proteinPer100g: 9, carbsPer100g: 49, fatPer100g: 3, imageUrl: null, breakfastOk: true, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "rice", nameEn: "White rice", nameAr: "أرز أبيض", slot: "carb", caloriesPer100g: 130, proteinPer100g: 3, carbsPer100g: 28, fatPer100g: 0, imageUrl: null, breakfastOk: false, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "couscous", nameEn: "Couscous", nameAr: "كسكسي", slot: "carb", caloriesPer100g: 176, proteinPer100g: 6, carbsPer100g: 36, fatPer100g: 0, imageUrl: null, breakfastOk: false, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "yoghurt", nameEn: "Yoghurt", nameAr: "ياغورت", slot: "protein", caloriesPer100g: 80, proteinPer100g: 7, carbsPer100g: 8, fatPer100g: 2, imageUrl: null, breakfastOk: true, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "almonds", nameEn: "Almonds", nameAr: "لوز", slot: "fat", caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, imageUrl: null, breakfastOk: true, isOwn: false, unitEn: null, unitEnPlural: null, unitAr: null, unitArPlural: null, unitGrams: null },
  { id: "dates", nameEn: "Dates", nameAr: "تمر", slot: "fruit", caloriesPer100g: 282, proteinPer100g: 2, carbsPer100g: 75, fatPer100g: 0, imageUrl: null, breakfastOk: true, isOwn: false, unitEn: "date", unitEnPlural: "dates", unitAr: "تمرة", unitArPlural: "تمرات", unitGrams: 8 },
];

/** Macros for a portion, the way every screen in the product computes them. */
export function macrosOf(item: EditorItem): MacroTotals {
  const k = item.quantityG / 100;
  return {
    calories: item.caloriesPer100g * k,
    proteinG: item.proteinPer100g * k,
    carbsG: item.carbsPer100g * k,
    fatG: item.fatPer100g * k,
  };
}

export function sumMacros(list: MacroTotals[]): MacroTotals {
  return list.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
