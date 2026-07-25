/**
 * Template gram-scaler — the "smart" half of the nutrition engine.
 *
 * The picker (meal-plan-gen.ts, greedy fill from the foods catalog) is retired.
 * Instead we take ONE pre-built template (chosen in meal-template-select.ts),
 * lay out the day's eating occasions from the questionnaire, substitute each
 * food slot for restrictions/dislikes, and scale every ingredient's grams so
 * the day hits the calorie + macro target. The plan stays fully editable
 * afterward, so this is a deterministic heuristic, not a precision solver.
 */

export type Slot = "protein" | "carb" | "vegetable" | "fat" | "fruit" | "legume" | "beverage";
export type SlotRole = "protein" | "carb" | "vegetable" | "fat" | "fruit" | "legume" | "caffeine";
export type MealKey = "meal_1" | "snack" | "meal_2" | "meal_3" | "pre_workout" | "post_workout" | "last_meal";

export type Ingredient = {
  id: string;
  slot: Slot;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  typicalServingG: number | null;
  budgetTier: "low" | "medium" | "high";
  tags: string[];
  isSlotDefault: boolean;
};

export type TemplateSlot = {
  mealKey: MealKey;
  orderIndex: number;
  ingredientId: string;
  role: SlotRole;
  isOptional: boolean;
};

export type MacroTarget = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DietConstraints = {
  budgetLevel: "low" | "medium" | "high";
  /** none | no_red_meat | no_fish | no_dairy | no_eggs | vegetarian */
  restrictions: string[];
  /** avoid tokens: chicken | eggs | tuna | fish | dairy | rice | pasta | bread | oats | legumes | vegetables */
  avoidFoods: string[];
  /** none | bloating | lactose | high_fiber | heavy_preworkout */
  digestion: string[];
  mealsPerDay: number;
  trainingDays: string; // "0" | "1_2" | "3_4" | "5_6" | "7"
};

export type FilledItem = {
  ingredientId: string;
  role: SlotRole;
  quantityG: number;
  isOptional: boolean;
};
export type FilledMeal = {
  mealKey: MealKey;
  orderIndex: number;
  items: FilledItem[];
};

const BUDGET_RANK = { low: 0, medium: 1, high: 2 } as const;

/** Which eating occasions appear, in display order, for a given meals/day. */
export function mealPlanForDay(mealsPerDay: number, trainingDays: string): MealKey[] {
  const trains = trainingDays !== "0";
  const order: MealKey[] = ["meal_1"];
  // 3 main meals → add a snack between meal 1 and meal 2; 5 → also add a snack.
  if (mealsPerDay === 3 || mealsPerDay >= 5) order.push("snack");
  order.push("meal_2");
  if (trains) order.push("pre_workout", "post_workout");
  order.push("meal_3");
  // last_meal is the 4th main meal — kept for 4/5 meals, dropped for 3.
  if (mealsPerDay >= 4) order.push("last_meal");
  return order;
}

/** True when an ingredient is allowed under the user's constraints. */
export function isIngredientAllowed(ing: Ingredient, c: DietConstraints): boolean {
  const has = (t: string) => ing.tags.includes(t);

  if (c.restrictions.includes("no_fish") && has("fish")) return false;
  if (c.restrictions.includes("no_dairy") && has("dairy")) return false;
  if (c.restrictions.includes("no_eggs") && has("egg")) return false;
  if (c.restrictions.includes("vegetarian") && !has("vegetarian")) return false;
  // no_red_meat: no template ingredient is red meat, so nothing to filter.

  if (c.digestion.includes("lactose") && has("dairy")) return false;

  for (const token of c.avoidFoods) {
    if (avoidMatches(token, ing)) return false;
  }
  return true;
}

function avoidMatches(token: string, ing: Ingredient): boolean {
  switch (token) {
    case "chicken":
      return ing.id === "chicken_breast" || ing.id === "chicken_thigh";
    case "eggs":
      return ing.id === "eggs";
    case "tuna":
      return ing.id === "tuna";
    case "fish":
      return ing.tags.includes("fish");
    case "dairy":
      return ing.tags.includes("dairy");
    case "rice":
      return ing.id === "white_rice";
    case "pasta":
      return ing.id === "pasta";
    case "bread":
      return ing.id === "whole_wheat_bread";
    case "oats":
      return ing.id === "oats";
    case "legumes":
      return ing.slot === "legume";
    case "vegetables":
      return ing.slot === "vegetable";
    default:
      return false;
  }
}

/**
 * Pick a same-slot replacement when the template's primary ingredient is
 * disallowed. Prefers budget-compatible, then the slot default, then any.
 * High-fiber legumes get swapped for a slow carb when fiber bothers the user.
 */
export function resolveIngredient(
  primaryId: string,
  role: SlotRole,
  byId: Map<string, Ingredient>,
  bySlot: Map<Slot, Ingredient[]>,
  c: DietConstraints,
): Ingredient | null {
  const primary = byId.get(primaryId);
  if (!primary) return null;

  // High fiber bothers the user → replace the last-meal legume with a slow carb.
  if (role === "legume" && c.digestion.includes("high_fiber")) {
    const carbAlt = pickFromPool(bySlot.get("carb") ?? [], c, primary.budgetTier);
    if (carbAlt) return carbAlt;
  }

  if (isIngredientAllowed(primary, c) && budgetOk(primary, c)) return primary;

  const pool = (bySlot.get(primary.slot) ?? []).filter((i) => i.id !== primary.id);
  return pickFromPool(pool, c, primary.budgetTier) ?? (isIngredientAllowed(primary, c) ? primary : null);
}

function budgetOk(ing: Ingredient, c: DietConstraints): boolean {
  return BUDGET_RANK[ing.budgetTier] <= BUDGET_RANK[c.budgetLevel];
}

function pickFromPool(pool: Ingredient[], c: DietConstraints, preferTier: string): Ingredient | null {
  const allowed = pool.filter((i) => isIngredientAllowed(i, c) && budgetOk(i, c));
  if (allowed.length === 0) return null;
  return (
    allowed.find((i) => i.budgetTier === preferTier && i.isSlotDefault) ??
    allowed.find((i) => i.isSlotDefault) ??
    allowed[0]
  );
}

const clampG = (g: number) => Math.round(Math.max(20, Math.min(400, g)));

/**
 * Scale each ingredient's grams so the day's totals land on target. Items are
 * pooled by the macro they primarily drive (protein/legume → protein, carb +
 * fruit → carbs, fat → fat); vegetables and coffee sit at a fixed serving.
 * One correction pass nudges each pool toward its target after cross-macro
 * contributions are known.
 */
export function fillTemplate(
  slots: TemplateSlot[],
  target: MacroTarget,
  byId: Map<string, Ingredient>,
  bySlot: Map<Slot, Ingredient[]>,
  c: DietConstraints,
): FilledMeal[] {
  const keptMeals = new Set(mealPlanForDay(c.mealsPerDay, c.trainingDays));

  type Resolved = { mealKey: MealKey; orderIndex: number; ing: Ingredient; role: SlotRole; isOptional: boolean; grams: number };
  const resolved: Resolved[] = [];

  for (const s of slots) {
    if (!keptMeals.has(s.mealKey)) continue;
    if (s.isOptional) continue; // whey/protein-bar are food-first optionals; skip by default
    const ing = resolveIngredient(s.ingredientId, s.role, byId, bySlot, c);
    if (!ing) continue;
    resolved.push({ mealKey: s.mealKey, orderIndex: s.orderIndex, ing, role: s.role, isOptional: s.isOptional, grams: 0 });
  }

  // Fixed-serving items first (vegetables, coffee).
  for (const r of resolved) {
    if (r.role === "vegetable") r.grams = clampG(r.ing.typicalServingG ?? 150);
    if (r.role === "caffeine") r.grams = r.ing.typicalServingG ?? 200;
  }

  const proteinPool = resolved.filter((r) => r.role === "protein" || r.role === "legume");
  const carbPool = resolved.filter((r) => r.role === "carb" || r.role === "fruit");
  const fatPool = resolved.filter((r) => r.role === "fat");

  sizePool(proteinPool, target.proteinG, (r) => r.ing.proteinPer100g);
  sizePool(carbPool, target.carbsG, (r) => r.ing.carbsPer100g);
  sizePool(fatPool, target.fatG, (r) => r.ing.fatPer100g);

  // One correction pass: rescale each pool by target/actual of its macro.
  correctPool(proteinPool, target.proteinG, totalMacro(resolved, (r) => r.ing.proteinPer100g));
  correctPool(carbPool, target.carbsG, totalMacro(resolved, (r) => r.ing.carbsPer100g));
  correctPool(fatPool, target.fatG, totalMacro(resolved, (r) => r.ing.fatPer100g));

  // Group back into meals, preserving order.
  const meals = new Map<MealKey, FilledMeal>();
  const dayOrder = mealPlanForDay(c.mealsPerDay, c.trainingDays);
  dayOrder.forEach((mk, i) => meals.set(mk, { mealKey: mk, orderIndex: i, items: [] }));
  for (const r of resolved) {
    const meal = meals.get(r.mealKey);
    if (!meal) continue;
    meal.items.push({ ingredientId: r.ing.id, role: r.role, quantityG: r.grams, isOptional: r.isOptional });
  }
  return dayOrder.map((mk) => meals.get(mk)!).filter((m) => m.items.length > 0);
}

function sizePool<T extends { ing: Ingredient; grams: number }>(
  pool: T[],
  targetG: number,
  per100: (r: T) => number,
): void {
  if (pool.length === 0) return;
  const share = targetG / pool.length;
  for (const r of pool) {
    const density = per100(r);
    r.grams = density > 0 ? clampG((share / density) * 100) : clampG(r.ing.typicalServingG ?? 100);
  }
}

function correctPool<T extends { ing: Ingredient; grams: number }>(pool: T[], targetG: number, actualG: number): void {
  if (pool.length === 0 || actualG <= 0) return;
  const scale = targetG / actualG;
  if (scale > 0.5 && scale < 2) {
    for (const r of pool) r.grams = clampG(r.grams * scale);
  }
}

function totalMacro<T extends { ing: Ingredient; grams: number }>(items: T[], per100: (r: T) => number): number {
  return items.reduce((sum, r) => sum + (per100(r) * r.grams) / 100, 0);
}
