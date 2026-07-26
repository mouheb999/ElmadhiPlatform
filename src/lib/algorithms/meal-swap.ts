/**
 * Per-food swap — exchange one planned food for a same-slot alternative while
 * keeping the meal's nutrition intact.
 *
 * The template solver (meal-template-fill.ts) is over-determined: with arbitrary
 * foods you cannot hit calories AND all three macros at once. So a swap does the
 * honest thing instead of pretending — it preserves the macro the original food
 * was actually there to deliver (its dominant macro by calorie share) and lets
 * the others land where they land. Since alternatives are drawn from the same
 * slot, both foods share a dominant macro, so calories stay close too.
 */

export type SwapFood = {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export type Macro = "protein" | "carbs" | "fat";

const KCAL = { protein: 4, carbs: 4, fat: 9 } as const;

/** Same bounds the plan solver uses, so a swap can't produce an absurd portion. */
const clampG = (g: number) => Math.round(Math.max(15, Math.min(500, g)));

const per100 = (food: SwapFood, macro: Macro): number =>
  macro === "protein" ? food.proteinPer100g : macro === "carbs" ? food.carbsPer100g : food.fatPer100g;

/**
 * The macro a food primarily delivers, by share of its own calories. Returns
 * null for foods that carry essentially nothing (coffee, plain vegetables) —
 * those swap on calories, or on grams when they have none either.
 */
export function dominantMacro(food: SwapFood): Macro | null {
  const contributions: [Macro, number][] = [
    ["protein", food.proteinPer100g * KCAL.protein],
    ["carbs", food.carbsPer100g * KCAL.carbs],
    ["fat", food.fatPer100g * KCAL.fat],
  ];
  let best: Macro | null = null;
  let bestKcal = 0;
  for (const [macro, kcal] of contributions) {
    if (kcal > bestKcal) {
      bestKcal = kcal;
      best = macro;
    }
  }
  return best;
}

/**
 * Grams of `to` that deliver the same nutrition as `fromQuantityG` of `from`.
 *
 * Matches the original's dominant macro exactly; falls back to matching
 * calories when that macro is absent from the replacement, and to keeping the
 * portion when neither food carries anything measurable.
 */
export function swapQuantityG(from: SwapFood, fromQuantityG: number, to: SwapFood): number {
  const factor = fromQuantityG / 100;

  // Only preserve the macro when both foods actually lead with it. Matching on a
  // trace amount (rice carries 0.3g fat/100g) would scale the portion absurdly,
  // so anything else falls through to calories.
  const macro = dominantMacro(from);
  if (macro && macro === dominantMacro(to)) {
    const toDensity = per100(to, macro);
    if (toDensity > 0) {
      return clampG((per100(from, macro) * factor * 100) / toDensity);
    }
  }

  // No shared macro to preserve — match calories instead.
  if (to.caloriesPer100g > 0) {
    return clampG((from.caloriesPer100g * factor * 100) / to.caloriesPer100g);
  }

  // Both are effectively free (coffee → tea): keep the same portion.
  return clampG(fromQuantityG);
}

/** The macro totals a food contributes at a given portion — for swap previews. */
export function contributionOf(food: SwapFood, quantityG: number) {
  const factor = quantityG / 100;
  return {
    calories: food.caloriesPer100g * factor,
    proteinG: food.proteinPer100g * factor,
    carbsG: food.carbsPer100g * factor,
    fatG: food.fatPer100g * factor,
  };
}
