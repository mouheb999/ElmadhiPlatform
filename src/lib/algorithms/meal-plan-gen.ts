/**
 * Diet engine orchestration — personalization-engine.md §3, §5.
 *
 * Layer 1 (hard filters: allergies, dietary restriction, budget) runs first
 * to shrink the food catalog to what's safe/affordable. Layer 3 (favorite
 * foods) only breaks ties within an already-safe pool. There is no goal-based
 * branching here — the strategy table in diet-strategy.ts already turned the
 * goal into a concrete macro target before this file runs.
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack_1" | "snack_2";

export type FoodCandidate = {
  id: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  allergens: string[] | null;
  tags: string[] | null;
  price_tier: string | null;
  is_common: boolean | null;
};

export type DietConstraints = {
  allergies: string[];
  dietaryRestriction: string | null;
  budgetLevel: "low" | "medium" | "high";
  dislikedFoodIds: string[];
  favoriteFoodIds: string[];
};

export type MacroTarget = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type GeneratedItem = { foodId: string; quantityG: number };
export type GeneratedMeal = { mealType: MealType; items: GeneratedItem[] };

/**
 * % of daily totals per meal slot. `meal_plan_meals.meal_type` only has 5
 * distinct values, so 6 meals/day (architecture.md's stated upper bound)
 * clamps to the 5-slot layout — a pre-existing schema limit, not new here.
 */
const MEAL_LAYOUTS: Record<number, [MealType, number][]> = {
  2: [["lunch", 0.55], ["dinner", 0.45]],
  3: [["breakfast", 0.25], ["lunch", 0.4], ["dinner", 0.35]],
  4: [["breakfast", 0.25], ["lunch", 0.35], ["dinner", 0.3], ["snack_1", 0.1]],
  5: [
    ["breakfast", 0.2],
    ["lunch", 0.3],
    ["dinner", 0.3],
    ["snack_1", 0.1],
    ["snack_2", 0.1],
  ],
};

export function mealLayoutFor(mealsPerDay: number): [MealType, number][] {
  const clamped = Math.min(Math.max(mealsPerDay, 2), 5);
  return MEAL_LAYOUTS[clamped];
}

/** Layer 1 — hard filter. Never violated regardless of preference scoring. */
export function filterSafeFoods(foods: FoodCandidate[], constraints: DietConstraints): FoodCandidate[] {
  return foods.filter((food) => {
    if (constraints.dislikedFoodIds.includes(food.id)) return false;

    if (food.allergens?.length && constraints.allergies.length) {
      if (food.allergens.some((a) => constraints.allergies.includes(a))) return false;
    }

    if (constraints.dietaryRestriction === "vegetarian" && food.category === "protein") {
      if (!food.tags?.includes("vegetarian")) return false;
    }
    if (constraints.dietaryRestriction === "pescatarian" && food.category === "protein") {
      if (!food.tags?.includes("vegetarian") && !food.tags?.includes("fish")) return false;
    }
    if (constraints.dietaryRestriction === "halal" && !food.tags?.includes("halal") && food.category === "protein") {
      // Only gate protein-category items; produce/grains are halal by default.
      return food.tags?.includes("halal") ?? false;
    }

    if (constraints.budgetLevel === "low" && food.price_tier === "high") return false;

    return true;
  });
}

/** Layer 3 — preference scoring within an already-safe pool. */
function pickBest(pool: FoodCandidate[], favoriteFoodIds: string[]): FoodCandidate | null {
  if (pool.length === 0) return null;
  const favorite = pool.find((f) => favoriteFoodIds.includes(f.id));
  if (favorite) return favorite;
  const common = pool.find((f) => f.is_common);
  return common ?? pool[0];
}

function quantityForMacro(food: FoodCandidate, targetG: number, perHundred: number): number {
  if (perHundred <= 0) return 0;
  const qty = (targetG / perHundred) * 100;
  return Math.round(Math.min(Math.max(qty, 20), 400));
}

/**
 * Greedy fill: one protein source, one carb source, one produce/fat source
 * per meal, each scaled to roughly hit that slot's share of the day's
 * macros. This is a heuristic starting point, not a precision solver — the
 * plan is fully editable afterward by design (architecture.md §1).
 */
export function generateMealPlan(
  target: MacroTarget,
  mealsPerDay: number,
  allFoods: FoodCandidate[],
  constraints: DietConstraints,
): GeneratedMeal[] {
  const safeFoods = filterSafeFoods(allFoods, constraints);
  const byCategory = (cat: string) => safeFoods.filter((f) => f.category === cat);

  const proteinPool = byCategory("protein");
  const carbPool = byCategory("grain");
  const fillerPool = [...byCategory("vegetable"), ...byCategory("fruit"), ...byCategory("dairy")];

  const layout = mealLayoutFor(mealsPerDay);

  return layout.map(([mealType, pct]) => {
    const mealProteinG = target.proteinG * pct;
    const mealCarbsG = target.carbsG * pct;

    const items: GeneratedItem[] = [];

    const protein = pickBest(proteinPool, constraints.favoriteFoodIds);
    if (protein) {
      items.push({ foodId: protein.id, quantityG: quantityForMacro(protein, mealProteinG, protein.protein_per_100g) });
    }

    const carb = pickBest(carbPool, constraints.favoriteFoodIds);
    if (carb) {
      items.push({ foodId: carb.id, quantityG: quantityForMacro(carb, mealCarbsG, carb.carbs_per_100g) });
    }

    const filler = pickBest(fillerPool, constraints.favoriteFoodIds);
    if (filler && !items.some((i) => i.foodId === filler.id)) {
      items.push({ foodId: filler.id, quantityG: 100 });
    }

    return { mealType, items };
  });
}
