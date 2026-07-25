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

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

const clampG = (g: number) => Math.round(Math.max(15, Math.min(500, g)));

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

  // Lean-protein guard. On a fat-tight target (an aggressive cut with high
  // protein), fatty proteins (eggs, mackerel, sardines) carry so much fat that
  // the fat target becomes physically unreachable and calories overshoot. When
  // a protein's fat-per-gram-of-protein far exceeds the day's budget, swap it
  // for a leaner same-slot protein — cycling through the lean options so the
  // day still varies. This is the coach's own "lean protein on a cut" rule.
  const fatPerProtein = target.fatG / Math.max(1, target.proteinG);
  const fatRatio = (i: Ingredient) => i.fatPer100g / Math.max(1, i.proteinPer100g);
  const leanChoices = (bySlot.get("protein") ?? [])
    .filter(
      (i) =>
        i.proteinPer100g > 0 &&
        !i.tags.includes("whey") &&
        i.id !== "protein_bar" &&
        isIngredientAllowed(i, c) &&
        budgetOk(i, c),
    )
    .sort((a, b) => fatRatio(a) - fatRatio(b));
  // Prefer proteins that fit the day's fat-per-protein budget; fall back to the
  // leanest available if none do (e.g. vegetarian, where only eggs remain).
  const withinBudget = leanChoices.filter((i) => fatRatio(i) <= fatPerProtein * 1.1);
  const pickList = withinBudget.length > 0 ? withinBudget : leanChoices;
  let leanCursor = 0;
  for (const r of resolved) {
    if (r.role !== "protein" || pickList.length === 0) continue;
    if (fatRatio(r.ing) > fatPerProtein * 1.2) {
      r.ing = pickList[leanCursor % pickList.length];
      leanCursor++;
    }
  }

  // Fixed-serving items first (vegetables, coffee).
  for (const r of resolved) {
    if (r.role === "vegetable") r.grams = clampG(r.ing.typicalServingG ?? 150);
    if (r.role === "caffeine") r.grams = r.ing.typicalServingG ?? 200;
  }

  const proteinPool = resolved.filter((r) => r.role === "protein" || r.role === "legume");
  const carbPool = resolved.filter((r) => r.role === "carb" || r.role === "fruit");
  const fatPool = resolved.filter((r) => r.role === "fat");

  const pPer = (r: Resolved) => r.ing.proteinPer100g;
  const cPer = (r: Resolved) => r.ing.carbsPer100g;
  const fPer = (r: Resolved) => r.ing.fatPer100g;

  // Seed each scalable item from a rough macro-based estimate.
  seedPool(proteinPool, target.proteinG, pPer);
  seedPool(carbPool, target.carbsG, cPer);
  seedPool(fatPool, target.fatG, fPer);

  // The three macros are coupled: protein foods carry fat and carbs, legumes
  // carry both, etc. — so we can't hit all three independently, and the target
  // is over-determined whenever the template's proteins are fatty (mackerel,
  // sardines, eggs). We resolve it the way a coach does: PROTEIN and total
  // CALORIES are the real targets and must land exactly; carbs are the balancer
  // that absorbs whatever fat the protein/fat foods happen to carry. So each
  // pass: nudge fat toward its target, hit protein exactly, then size carbs to
  // fill the remaining calories after protein and fat are counted.
  for (let i = 0; i < 24; i++) {
    // Fat may drop to zero: if the (fatty) proteins already exceed the fat
    // target, we remove the added oils/nuts rather than keep a token drizzle.
    solvePool(fatPool, resolved, target.fatG, fPer, true);
    solvePool(proteinPool, resolved, target.proteinG, pPer);
    const proteinKcal = macroTotal(resolved, pPer) * KCAL_PER_G_PROTEIN;
    const fatKcal = macroTotal(resolved, fPer) * KCAL_PER_G_FAT;
    const carbTargetG = Math.max(0, (target.calories - proteinKcal - fatKcal) / KCAL_PER_G_CARBS);
    solvePool(carbPool, resolved, carbTargetG, cPer);
  }

  // Drop any added-fat item the solver shrank to a negligible amount.
  for (const r of resolved) if (r.grams < 8) r.grams = 0;

  // Group back into meals, preserving order.
  const meals = new Map<MealKey, FilledMeal>();
  const dayOrder = mealPlanForDay(c.mealsPerDay, c.trainingDays);
  dayOrder.forEach((mk, i) => meals.set(mk, { mealKey: mk, orderIndex: i, items: [] }));
  for (const r of resolved) {
    if (r.grams <= 0) continue; // dropped by the solver (e.g. redundant added fat)
    const meal = meals.get(r.mealKey);
    if (!meal) continue;
    meal.items.push({ ingredientId: r.ing.id, role: r.role, quantityG: r.grams, isOptional: r.isOptional });
  }
  return dayOrder.map((mk) => meals.get(mk)!).filter((m) => m.items.length > 0);
}

type Scalable = { ing: Ingredient; grams: number };

/** Rough starting grams: split the macro target equally across the pool. */
function seedPool<T extends Scalable>(pool: T[], targetG: number, per100: (r: T) => number): void {
  if (pool.length === 0) return;
  const share = targetG / pool.length;
  for (const r of pool) {
    const density = per100(r);
    r.grams = density > 0 ? clampG((share / density) * 100) : clampG(r.ing.typicalServingG ?? 100);
  }
}

function macroTotal<T extends Scalable>(items: T[], per100: (r: T) => number): number {
  return items.reduce((sum, r) => sum + (per100(r) * r.grams) / 100, 0);
}

/**
 * Rescale `pool` so the whole plan hits `targetG` of this macro. The pool only
 * needs to supply `target − (macro already provided by every non-pool item)`;
 * the factor is damped to [0.25, 4] per pass so the coupled iteration settles
 * instead of oscillating. If other items already exceed the target the pool is
 * shrunk toward its minimum.
 */
function solvePool<T extends Scalable>(
  pool: T[],
  all: T[],
  targetG: number,
  per100: (r: T) => number,
  canDrop = false,
): void {
  if (pool.length === 0) return;
  const poolNow = macroTotal(pool, per100);
  if (poolNow <= 0) return;
  const fromOthers = macroTotal(all, per100) - poolNow;
  const needed = targetG - fromOthers;
  // Others already cover the target → shrink the pool. When canDrop, let it
  // fall below the normal floor toward zero so the item can be removed.
  if (needed <= 0) {
    for (const r of pool) r.grams = canDrop ? Math.round(r.grams * 0.4) : clampG(r.grams * 0.5);
    return;
  }
  const factor = Math.max(0.25, Math.min(4, needed / poolNow));
  for (const r of pool) r.grams = clampG(r.grams * factor);
}
