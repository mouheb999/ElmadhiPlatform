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
  /**
   * May this food appear in Meal 1? Chicken breast is a perfectly good protein
   * and a terrible breakfast; without this the substitution step would serve it
   * at 7am to anyone who avoids eggs. Defaults to true for foods loaded from a
   * database that predates migration 036.
   */
  breakfastOk?: boolean;
  /**
   * The mirror of `breakfastOk`, for Meal 2 / Meal 3 / the last meal. Greek
   * yogurt is a perfectly good protein and a terrible dinner; without this the
   * lean-protein guard below — which sorts the protein slot by fat-per-protein
   * and takes the leanest — would put a yogurt pot next to the rice. Defaults
   * to true for foods loaded from a database that predates migration 049.
   */
  mainMealOk?: boolean;
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

/**
 * Which eating occasions appear, in display order, for a given meals/day.
 *
 * post_workout is deliberately absent: it was a two-item stub between two real
 * meals, and its food is folded into the next one instead (see
 * `absorbingMealKey`). pre_workout stays — a coffee and a banana before
 * training is a real instruction, not a meal pretending to be one.
 */
export function mealPlanForDay(mealsPerDay: number, trainingDays: string): MealKey[] {
  const trains = trainingDays !== "0";
  const order: MealKey[] = ["meal_1"];
  // 3 main meals → add a snack between meal 1 and meal 2; 5 → also add a snack.
  if (mealsPerDay === 3 || mealsPerDay >= 5) order.push("snack");
  order.push("meal_2");
  if (trains) order.push("pre_workout");
  order.push("meal_3");
  // last_meal is the 4th main meal — kept for 4/5 meals, dropped for 3.
  if (mealsPerDay >= 4) order.push("last_meal");
  return order;
}

/**
 * Where a template slot's food actually lands, or null if it is not eaten today.
 *
 * Only post_workout moves: its items join Meal 3, the next meal in the day.
 * The move is limited to users who train, because a non-trainer never had those
 * items in the first place — folding them in would silently add food to a plan
 * that was already correct.
 */
export function absorbingMealKey(
  mealKey: MealKey,
  dayOrder: MealKey[],
  trains: boolean,
): MealKey | null {
  if (dayOrder.includes(mealKey)) return mealKey;
  if (mealKey === "post_workout" && trains && dayOrder.includes("meal_3")) return "meal_3";
  return null;
}

/** The eating occasions that are a plate of food rather than a snack. */
const MAIN_MEALS: readonly MealKey[] = ["meal_2", "meal_3", "last_meal"];

/**
 * Foods that may fill a given meal.
 *
 * Two gates, pulling in opposite directions: `breakfastOk` keeps grilled
 * chicken out of Meal 1, `mainMealOk` keeps a yogurt pot out of dinner. Snacks
 * and pre-workout are deliberately ungated — that is where honey, dates and a
 * protein bar belong.
 */
export function isMealAppropriate(ing: Ingredient, mealKey: MealKey): boolean {
  if (mealKey === "meal_1") return ing.breakfastOk !== false;
  if (MAIN_MEALS.includes(mealKey)) return ing.mainMealOk !== false;
  return true;
}

/** True when an ingredient is allowed under the user's constraints. */
export function isIngredientAllowed(ing: Ingredient, c: DietConstraints): boolean {
  const has = (t: string) => ing.tags.includes(t);

  if (c.restrictions.includes("no_fish") && has("fish")) return false;
  if (c.restrictions.includes("no_dairy") && has("dairy")) return false;
  if (c.restrictions.includes("no_eggs") && has("egg")) return false;
  if (c.restrictions.includes("vegetarian") && !has("vegetarian")) return false;
  // Migration 049 put beef, lamb, liver and merguez in the catalog, so this
  // restriction finally has something to exclude. Before 049 it was a no-op.
  if (c.restrictions.includes("no_red_meat") && has("red_meat")) return false;

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
    // These tokens name a food in the user's words, not a row id, so they must
    // match every row that IS that food — migration 049 added a second rice and
    // two more breads, and "no bread" that still serves baguette is a bug.
    case "rice":
      return ing.id === "white_rice" || ing.id === "brown_rice";
    case "pasta":
      return ing.id === "pasta";
    case "bread":
      return ing.id === "whole_wheat_bread" || ing.id === "baguette" || ing.id === "tabouna_bread";
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
 *
 * `mealKey` narrows the pool to what belongs in that meal. At breakfast the
 * filter is strict on purpose: if nothing appropriate survives the user's
 * restrictions (a vegan avoiding eggs and dairy), the slot is dropped and the
 * day's protein is carried by the other meals. A breakfast with no protein
 * beats a breakfast with grilled chicken in it.
 */
export function resolveIngredient(
  primaryId: string,
  role: SlotRole,
  mealKey: MealKey,
  byId: Map<string, Ingredient>,
  bySlot: Map<Slot, Ingredient[]>,
  c: DietConstraints,
): Ingredient | null {
  const primary = byId.get(primaryId);
  if (!primary) return null;

  const fits = (i: Ingredient) => isMealAppropriate(i, mealKey);

  // High fiber bothers the user → replace the last-meal legume with a slow carb.
  if (role === "legume" && c.digestion.includes("high_fiber")) {
    const carbAlt = pickFromPool((bySlot.get("carb") ?? []).filter(fits), c, primary.budgetTier);
    if (carbAlt) return carbAlt;
  }

  if (isIngredientAllowed(primary, c) && budgetOk(primary, c) && fits(primary)) return primary;

  const pool = (bySlot.get(primary.slot) ?? []).filter((i) => i.id !== primary.id && fits(i));
  return (
    pickFromPool(pool, c, primary.budgetTier) ??
    (isIngredientAllowed(primary, c) && fits(primary) ? primary : null)
  );
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

const MIN_ITEM_G = 15;
const MAX_ITEM_G = 500;

const clampG = (g: number, maxG: number = MAX_ITEM_G) =>
  Math.round(Math.max(MIN_ITEM_G, Math.min(maxG, g)));

/**
 * The ceiling on ONE item's portion.
 *
 * Fruit is in the carb pool, and the solver scales every member of a pool by
 * the same factor. An apple carries 14 g of carbs per 100 g where rice carries
 * 28, so hitting a big carb target with both in the pool asks the apple for
 * twice the grams of the rice — and the plans came out saying "424 g apple",
 * which is three apples in a snack and reads as a bug even though the macros
 * are right.
 *
 * Rice, oats and potatoes genuinely are portioned by weight, so they can take
 * whatever the target needs. Fruit is eaten in units, so it gets a ceiling of
 * two typical servings and the starches absorb the remainder. The solver
 * iterates 24 times against `fromOthers`, so a pinned fruit simply becomes part
 * of what the rest has to make up.
 */
function maxGramsFor(ing: Ingredient, role: SlotRole): number {
  if (role !== "fruit") return MAX_ITEM_G;
  const typical = ing.typicalServingG ?? 150;
  return Math.min(MAX_ITEM_G, Math.max(60, Math.round(typical * 2)));
}

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
  const dayPlan = mealPlanForDay(c.mealsPerDay, c.trainingDays);
  const trains = c.trainingDays !== "0";

  type Resolved = { mealKey: MealKey; orderIndex: number; ing: Ingredient; role: SlotRole; isOptional: boolean; grams: number; maxG: number; fixed: boolean };
  const resolved: Resolved[] = [];

  for (const s of slots) {
    const mealKey = absorbingMealKey(s.mealKey, dayPlan, trains);
    if (!mealKey) continue;
    if (s.isOptional) continue; // whey/protein-bar are food-first optionals; skip by default
    const ing = resolveIngredient(s.ingredientId, s.role, mealKey, byId, bySlot, c);
    if (!ing) continue;
    resolved.push({
      mealKey,
      // Absorbed items sort after the host meal's own foods rather than
      // interleaving with them by their old index.
      orderIndex: mealKey === s.mealKey ? s.orderIndex : 100 + s.orderIndex,
      ing,
      role: s.role,
      isOptional: s.isOptional,
      grams: 0,
      maxG: maxGramsFor(ing, s.role),
      fixed: false,
    });
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
        // Only ever swapped into a main meal below, so the pool is built from
        // foods that can BE a main meal. Greek yogurt is the leanest protein in
        // the catalog and would otherwise win this sort every time.
        i.mainMealOk !== false &&
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
    // Breakfast stays egg-based (spec: Meal 1 = egg protein + carb + fat +
    // coffee) — never swap a dinner protein like turkey/fish into meal_1.
    if (r.role !== "protein" || r.mealKey === "meal_1" || pickList.length === 0) continue;
    if (fatRatio(r.ing) > fatPerProtein * 1.2) {
      r.ing = pickList[leanCursor % pickList.length];
      r.maxG = maxGramsFor(r.ing, r.role);
      leanCursor++;
    }
  }

  // Fixed-serving items: vegetables, coffee, and the breakfast protein. The
  // breakfast protein is pinned to a normal portion (~2-3 eggs) rather than
  // scaled — otherwise the solver dumps the whole day's protein (and its fat)
  // into breakfast eggs. The leaner lunch/dinner proteins carry the rest.
  for (const r of resolved) {
    if (r.role === "vegetable") r.grams = clampG(r.ing.typicalServingG ?? 150, r.maxG);
    if (r.role === "caffeine") r.grams = r.ing.typicalServingG ?? 200;
    if (r.role === "protein" && r.mealKey === "meal_1") {
      r.grams = clampG(r.ing.typicalServingG ?? 120, r.maxG);
      r.fixed = true;
    }
  }

  const proteinPool = resolved.filter((r) => (r.role === "protein" || r.role === "legume") && !r.fixed);
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
    // Carbs fill whatever calories remain after protein and fat. Droppable so a
    // low-carb cut can shed filler carbs (fruit) instead of overshooting kcal.
    const carbTargetG = Math.max(0, (target.calories - proteinKcal - fatKcal) / KCAL_PER_G_CARBS);
    solvePool(carbPool, resolved, carbTargetG, cPer, true);
  }

  // Drop any added-fat item the solver shrank to a negligible amount.
  for (const r of resolved) if (r.grams < 8) r.grams = 0;

  // Group back into meals, preserving order.
  const meals = new Map<MealKey, FilledMeal>();
  dayPlan.forEach((mk, i) => meals.set(mk, { mealKey: mk, orderIndex: i, items: [] }));
  for (const r of [...resolved].sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (r.grams <= 0) continue; // dropped by the solver (e.g. redundant added fat)
    const meal = meals.get(r.mealKey);
    if (!meal) continue;
    // Absorbing post-workout can bring in a food the host meal already has —
    // one line of "dates 40 g" reads better than two lines that must be added up.
    const existing = meal.items.find((i) => i.ingredientId === r.ing.id);
    if (existing) {
      existing.quantityG += r.grams;
      continue;
    }
    meal.items.push({ ingredientId: r.ing.id, role: r.role, quantityG: r.grams, isOptional: r.isOptional });
  }
  return dayPlan.map((mk) => meals.get(mk)!).filter((m) => m.items.length > 0);
}

type Scalable = { ing: Ingredient; grams: number; maxG: number };

/** Rough starting grams: split the macro target equally across the pool. */
function seedPool<T extends Scalable>(pool: T[], targetG: number, per100: (r: T) => number): void {
  if (pool.length === 0) return;
  const share = targetG / pool.length;
  for (const r of pool) {
    const density = per100(r);
    r.grams = density > 0 ? clampG((share / density) * 100, r.maxG) : clampG(r.ing.typicalServingG ?? 100, r.maxG);
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
    for (const r of pool) r.grams = canDrop ? Math.round(r.grams * 0.4) : clampG(r.grams * 0.5, r.maxG);
    return;
  }
  const factor = Math.max(0.25, Math.min(4, needed / poolNow));
  for (const r of pool) r.grams = clampG(r.grams * factor, r.maxG);
}
