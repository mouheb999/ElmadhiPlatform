import { describe, expect, it } from "vitest";
import { calculateMacros, type MacroProfileInput } from "./macros";
import { resolveGoalStrategy } from "./diet-strategy";
import {
  fillTemplate,
  mealPlanForDay,
  isIngredientAllowed,
  isMealAppropriate,
  type DietConstraints,
  type Ingredient,
  type Slot,
  type TemplateSlot,
} from "./meal-template-fill";
import { selectTemplate, type MealTemplate } from "./meal-template-select";

const maleProfile = {
  gender: "male" as const,
  birthDate: new Date(new Date().getFullYear() - 25, 0, 1),
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate" as const,
};

// Mifflin for this profile: 10*80 + 6.25*180 - 5*25 + 5 = 1805.
// Activity "moderate" is 1.40 under the simplified calculator, so 1805 * 1.4
// = 2527 kcal maintenance.
const BMR = 1805;
const TDEE = 2527;

describe("calculateMacros", () => {
  it("uses Mifflin BMR and the occupational activity factor for TDEE", () => {
    const m = calculateMacros({ ...maleProfile, goal: "maintain" });
    expect(m.bmr).toBe(BMR);
    expect(m.tdee).toBe(TDEE);
    expect(m.usedLeanMass).toBe(false);
  });

  it("walks the five activity bands from 1.20 to 1.60", () => {
    const at = (activityLevel: MacroProfileInput["activityLevel"]) =>
      calculateMacros({ ...maleProfile, activityLevel, goal: "maintain" }).tdee;
    expect(at("sedentary")).toBe(Math.round(BMR * 1.2));
    expect(at("light")).toBe(Math.round(BMR * 1.3));
    expect(at("moderate")).toBe(Math.round(BMR * 1.4));
    expect(at("active")).toBe(Math.round(BMR * 1.5));
    expect(at("very_active")).toBe(Math.round(BMR * 1.6));
  });

  it("applies the four flat goal multipliers, rounded to the nearest ten", () => {
    const cal = (goal: MacroProfileInput["goal"]) => calculateMacros({ ...maleProfile, goal }).calories;
    expect(cal("build_muscle")).toBe(Math.round((TDEE * 1.07) / 10) * 10);
    expect(cal("lose_fat")).toBe(Math.round((TDEE * 0.85) / 10) * 10);
    expect(cal("recomp")).toBe(Math.round(TDEE / 10) * 10);
    expect(cal("maintain")).toBe(Math.round(TDEE / 10) * 10);
  });

  it("gives 2.0 g/kg of protein to every goal but plain maintenance, which gets 1.6", () => {
    for (const goal of ["lose_fat", "build_muscle", "recomp"] as const) {
      expect(calculateMacros({ ...maleProfile, goal }).proteinG).toBe(160);
    }
    expect(calculateMacros({ ...maleProfile, goal: "maintain" }).proteinG).toBe(128);
  });

  it("prescribes 0.9 g/kg of fat when the budget allows it", () => {
    expect(calculateMacros({ ...maleProfile, goal: "maintain" }).fatG).toBe(72);
  });

  it("follows the formula order: carbs are the remainder, fiber from final calories", () => {
    const m = calculateMacros({ ...maleProfile, goal: "recomp" });
    expect(m.carbsG).toBe(Math.round((m.calories - m.proteinG * 4 - m.fatG * 9) / 4));
    expect(m.fiberG).toBe(Math.round((m.calories / 1000) * 14));
  });

  it("never drops below the 1200 kcal floor", () => {
    const tiny = calculateMacros({
      gender: "female",
      birthDate: new Date(new Date().getFullYear() - 60, 0, 1),
      heightCm: 145,
      weightKg: 42,
      activityLevel: "sedentary",
      goal: "lose_fat",
    });
    expect(tiny.calories).toBeGreaterThanOrEqual(1200);
  });

  // The sheet's `fat >= poids × 0.7` minimum exists for exactly this case:
  // 200 g protein + 90 g fat is 1610 of a 1620 kcal budget, and carbs would be
  // left with nothing. Fat has 0.2 g/kg of give and we spend it here.
  it("spends fat down to its 0.7 g/kg floor rather than starving carbs", () => {
    const heavyCut = calculateMacros({
      gender: "female",
      birthDate: new Date(new Date().getFullYear() - 50, 0, 1),
      heightCm: 160,
      weightKg: 100,
      activityLevel: "sedentary",
      goal: "lose_fat",
    });
    expect(heavyCut.fatG).toBeLessThan(Math.round(0.9 * 100));
    expect(heavyCut.fatG).toBeGreaterThanOrEqual(Math.round(0.7 * 100));
    expect(heavyCut.carbsG).toBeGreaterThan(0);
  });

  it("body fat is not an input to calories or macros — only to resting energy", () => {
    const withPct = calculateMacros({ ...maleProfile, goal: "lose_fat", bodyFatPercent: 20 });
    const without = calculateMacros({ ...maleProfile, goal: "lose_fat" });
    // Protein and fat come off bodyweight, which did not change.
    expect(withPct.proteinG).toBe(without.proteinG);
    // 80 kg at 20 % = 64 kg lean -> 500 + 22*64 = 1908, above Mifflin's 1805.
    expect(withPct.bmr).toBe(1908);
    expect(withPct.usedLeanMass).toBe(true);
    expect(withPct.calories).toBeGreaterThan(without.calories);
  });

  it("ignores a body-fat percentage that cannot be real", () => {
    for (const bodyFatPercent of [0, 1, 75, 100, Number.NaN]) {
      const m = calculateMacros({ ...maleProfile, goal: "maintain", bodyFatPercent });
      expect(m.usedLeanMass).toBe(false);
      expect(m.bmr).toBe(BMR);
    }
  });
});

describe("resolveGoalStrategy", () => {
  it("matches the sheet's four multipliers exactly", () => {
    expect(resolveGoalStrategy("build_muscle").calorieFactor).toBe(1.07);
    expect(resolveGoalStrategy("lose_fat").calorieFactor).toBe(0.85);
    expect(resolveGoalStrategy("recomp").calorieFactor).toBe(1);
    expect(resolveGoalStrategy("maintain").calorieFactor).toBe(1);
  });
});

// ---- template fill ----

// `breakfastOk: false` mirrors migration 036 — chicken, tuna and rice are
// lunch/dinner foods and must never be substituted into Meal 1.
const ING: Ingredient[] = [
  ing("chicken_breast", "protein", { protein: 31, carbs: 0, fat: 3.6, cal: 165 }, ["poultry"], true, false),
  ing("tuna", "protein", { protein: 26, carbs: 0, fat: 1, cal: 116 }, ["fish"], false, false),
  ing("eggs", "protein", { protein: 13, carbs: 1.1, fat: 10, cal: 143 }, ["egg", "vegetarian"], false),
  ing("white_rice", "carb", { protein: 2.7, carbs: 28, fat: 0.3, cal: 130 }, ["vegetarian"], true, false),
  ing("oats", "carb", { protein: 13, carbs: 67, fat: 6.5, cal: 379 }, ["vegetarian"], false),
  ing("olive_oil", "fat", { protein: 0, carbs: 0, fat: 100, cal: 884 }, ["vegetarian"], true),
  ing("mixed_salad", "vegetable", { protein: 1.2, carbs: 3.6, fat: 0.2, cal: 20 }, ["vegetarian"], true),
  ing("banana", "fruit", { protein: 1.1, carbs: 23, fat: 0.3, cal: 89 }, ["vegetarian"], true),
  ing("lentils", "legume", { protein: 9, carbs: 20, fat: 0.4, cal: 116 }, ["vegetarian", "legume", "high_fiber"], true),
  ing("coffee", "beverage", { protein: 0, carbs: 0, fat: 0, cal: 2 }, ["caffeine"], true),
];

function ing(
  id: string,
  slot: Slot,
  m: { protein: number; carbs: number; fat: number; cal: number },
  tags: string[],
  isDefault: boolean,
  breakfastOk = true,
  mainMealOk = true,
): Ingredient {
  return {
    id,
    slot,
    caloriesPer100g: m.cal,
    proteinPer100g: m.protein,
    carbsPer100g: m.carbs,
    fatPer100g: m.fat,
    typicalServingG: 150,
    budgetTier: "low",
    tags,
    isSlotDefault: isDefault,
    breakfastOk,
    mainMealOk,
  };
}

const byId = new Map(ING.map((i) => [i.id, i]));
const bySlot = new Map<Slot, Ingredient[]>();
for (const i of ING) bySlot.set(i.slot, [...(bySlot.get(i.slot) ?? []), i]);

const SLOTS: TemplateSlot[] = [
  slot("meal_1", 1, "eggs", "protein"),
  slot("meal_1", 2, "oats", "carb"),
  slot("meal_1", 3, "coffee", "caffeine"),
  slot("meal_2", 1, "chicken_breast", "protein"),
  slot("meal_2", 2, "white_rice", "carb"),
  slot("meal_2", 3, "mixed_salad", "vegetable"),
  slot("meal_2", 4, "olive_oil", "fat"),
  slot("meal_3", 1, "tuna", "protein"),
  slot("meal_3", 2, "white_rice", "carb"),
  slot("meal_3", 3, "olive_oil", "fat"),
  slot("pre_workout", 1, "coffee", "caffeine"),
  slot("pre_workout", 2, "banana", "fruit"),
  slot("post_workout", 1, "banana", "fruit"),
  slot("last_meal", 1, "lentils", "legume"),
  slot("last_meal", 2, "eggs", "protein"),
];

function slot(mealKey: TemplateSlot["mealKey"], order: number, id: string, role: TemplateSlot["role"]): TemplateSlot {
  return { mealKey, orderIndex: order, ingredientId: id, role, isOptional: false };
}

const baseConstraints: DietConstraints = {
  budgetLevel: "high",
  restrictions: [],
  avoidFoods: [],
  digestion: [],
  mealsPerDay: 4,
  trainingDays: "3_4",
};

describe("mealPlanForDay", () => {
  it("3 meals gets a snack and no last meal", () => {
    const plan = mealPlanForDay(3, "3_4");
    expect(plan).toContain("snack");
    expect(plan).not.toContain("last_meal");
  });
  it("4 meals gets the last meal and no snack", () => {
    const plan = mealPlanForDay(4, "3_4");
    expect(plan).toContain("last_meal");
    expect(plan).not.toContain("snack");
  });
  it("drops pre/post workout when not training", () => {
    const plan = mealPlanForDay(4, "0");
    expect(plan).not.toContain("pre_workout");
    expect(plan).not.toContain("post_workout");
  });
  it("never lists post-workout as its own meal, even for a trainer", () => {
    expect(mealPlanForDay(5, "5_6")).not.toContain("post_workout");
    expect(mealPlanForDay(5, "5_6")).toContain("pre_workout");
  });
});

describe("post-workout is folded into the next meal", () => {
  const target = { calories: 2200, proteinG: 170, carbsG: 200, fatG: 60 };

  function itemsIn(meals: ReturnType<typeof fillTemplate>, mealKey: string) {
    return meals.find((m) => m.mealKey === mealKey)?.items.map((i) => i.ingredientId) ?? [];
  }

  it("moves the post-workout food into meal 3 for someone who trains", () => {
    const meals = fillTemplate(SLOTS, target, byId, bySlot, baseConstraints);
    expect(meals.map((m) => m.mealKey)).not.toContain("post_workout");
    // The template's post-workout banana is eaten with meal 3 instead.
    expect(itemsIn(meals, "meal_3")).toContain("banana");
  });

  it("keeps it out of the plan entirely for someone who does not train", () => {
    const meals = fillTemplate(SLOTS, target, byId, bySlot, {
      ...baseConstraints,
      trainingDays: "0",
    });
    expect(meals.map((m) => m.mealKey)).not.toContain("post_workout");
    // No pre-workout meal either, so no banana anywhere: the non-trainer's plan
    // is unchanged by the fold.
    expect(meals.flatMap((m) => m.items.map((i) => i.ingredientId))).not.toContain("banana");
  });

  it("merges rather than listing the same food twice in one meal", () => {
    const withDuplicate: TemplateSlot[] = [
      ...SLOTS,
      { mealKey: "post_workout", orderIndex: 2, ingredientId: "white_rice", role: "carb", isOptional: false },
    ];
    const meals = fillTemplate(withDuplicate, target, byId, bySlot, baseConstraints);
    const rice = itemsIn(meals, "meal_3").filter((id) => id === "white_rice");
    expect(rice).toHaveLength(1);
  });
});

describe("breakfast stays breakfast", () => {
  const target = { calories: 2200, proteinG: 170, carbsG: 200, fatG: 60 };

  function breakfast(c: Partial<DietConstraints> = {}) {
    const meals = fillTemplate(SLOTS, target, byId, bySlot, { ...baseConstraints, ...c });
    return meals.find((m) => m.mealKey === "meal_1")?.items.map((i) => i.ingredientId) ?? [];
  }

  it("does not serve chicken at 7am when the user avoids eggs", () => {
    const items = breakfast({ avoidFoods: ["eggs"] });
    expect(items).not.toContain("chicken_breast");
    expect(items).not.toContain("tuna");
  });

  it("drops the slot rather than substituting a dinner food", () => {
    // eggs are the only breakfast-appropriate protein in the fixture, so
    // avoiding them leaves Meal 1 with its carb and coffee and no protein.
    const items = breakfast({ avoidFoods: ["eggs"] });
    expect(items).toContain("oats");
    expect(items.length).toBeGreaterThan(0);
  });

  it("still uses the template's own breakfast protein when it is allowed", () => {
    expect(breakfast()).toContain("eggs");
  });

  it("substitutes a breakfast-appropriate carb, not rice", () => {
    const items = breakfast({ avoidFoods: ["oats"] });
    expect(items).not.toContain("white_rice");
  });
});

describe("fillTemplate", () => {
  const target = { calories: 2200, proteinG: 170, carbsG: 200, fatG: 60 };

  function totals(meals: ReturnType<typeof fillTemplate>) {
    let P = 0, C = 0, F = 0;
    for (const meal of meals)
      for (const item of meal.items) {
        const ing = byId.get(item.ingredientId)!;
        P += (ing.proteinPer100g * item.quantityG) / 100;
        C += (ing.carbsPer100g * item.quantityG) / 100;
        F += (ing.fatPer100g * item.quantityG) / 100;
      }
    return { P, C, F, kcal: P * 4 + C * 4 + F * 9 };
  }

  it("hits protein and total calories closely", () => {
    const t = totals(fillTemplate(SLOTS, target, byId, bySlot, baseConstraints));
    // Protein and calories are the hard targets (carbs/fat flex).
    expect(t.P).toBeGreaterThan(target.proteinG * 0.9);
    expect(t.P).toBeLessThan(target.proteinG * 1.1);
    expect(t.kcal).toBeGreaterThan(target.calories * 0.9);
    expect(t.kcal).toBeLessThan(target.calories * 1.12);
  });

  // The "424 g of apple" report: fruit shares the carb pool with rice, and the
  // solver scales a pool uniformly, so a big carb target asked the low-density
  // food for an absurd portion.
  it("caps fruit at two typical servings and lets the starch carry the rest", () => {
    const bigCarbs = { calories: 3200, proteinG: 170, carbsG: 450, fatG: 80 };
    const meals = fillTemplate(SLOTS, bigCarbs, byId, bySlot, baseConstraints);
    const banana = meals
      .flatMap((m) => m.items)
      .filter((i) => i.ingredientId === "banana");
    for (const item of banana) {
      // typicalServingG is 150 in the test fixture -> ceiling 300.
      expect(item.quantityG).toBeLessThanOrEqual(300);
    }
    // The carb target is still met — the starch took the slack.
    const totalCarbs = meals
      .flatMap((m) => m.items)
      .reduce((sum, i) => sum + (byId.get(i.ingredientId)!.carbsPer100g * i.quantityG) / 100, 0);
    expect(totalCarbs).toBeGreaterThan(bigCarbs.carbsG * 0.85);
  });

  it("keeps every portion within sane bounds", () => {
    const meals = fillTemplate(SLOTS, target, byId, bySlot, baseConstraints);
    for (const meal of meals) {
      for (const item of meal.items) {
        expect(item.quantityG).toBeGreaterThanOrEqual(15);
        expect(item.quantityG).toBeLessThanOrEqual(500);
      }
    }
  });

  it("substitutes fish away under a no-fish restriction", () => {
    const meals = fillTemplate(SLOTS, target, byId, bySlot, { ...baseConstraints, restrictions: ["no_fish"] });
    const ids = meals.flatMap((m) => m.items.map((i) => i.ingredientId));
    expect(ids).not.toContain("tuna");
  });
});

describe("isIngredientAllowed", () => {
  it("vegetarian keeps eggs but drops chicken", () => {
    const c = { ...baseConstraints, restrictions: ["vegetarian"] };
    expect(isIngredientAllowed(byId.get("eggs")!, c)).toBe(true);
    expect(isIngredientAllowed(byId.get("chicken_breast")!, c)).toBe(false);
  });
  it("avoid tokens remove the named food", () => {
    const c = { ...baseConstraints, avoidFoods: ["rice"] };
    expect(isIngredientAllowed(byId.get("white_rice")!, c)).toBe(false);
  });

  // Migration 049. `no_red_meat` was a documented no-op until beef, lamb,
  // liver and merguez entered the catalog.
  it("no_red_meat drops red meat and leaves poultry alone", () => {
    const c = { ...baseConstraints, restrictions: ["no_red_meat"] };
    const beef = ing("beef_mince", "protein", { protein: 20, carbs: 0, fat: 10, cal: 176 }, ["red_meat"], false, false);
    expect(isIngredientAllowed(beef, c)).toBe(false);
    expect(isIngredientAllowed(byId.get("chicken_breast")!, c)).toBe(true);
  });
});

// ---- migration 049: where a food is allowed to appear ----

describe("isMealAppropriate", () => {
  const yogurt = ing(
    "greek_yogurt",
    "protein",
    { protein: 10, carbs: 3.6, fat: 0.4, cal: 59 },
    ["dairy", "vegetarian"],
    false,
    true,  // breakfast: yes
    false, // dinner: no
  );

  it("keeps a dinner protein out of breakfast", () => {
    expect(isMealAppropriate(byId.get("chicken_breast")!, "meal_1")).toBe(false);
    expect(isMealAppropriate(byId.get("chicken_breast")!, "meal_2")).toBe(true);
  });

  it("keeps a breakfast protein out of the main meals", () => {
    expect(isMealAppropriate(yogurt, "meal_1")).toBe(true);
    expect(isMealAppropriate(yogurt, "meal_2")).toBe(false);
    expect(isMealAppropriate(yogurt, "meal_3")).toBe(false);
    expect(isMealAppropriate(yogurt, "last_meal")).toBe(false);
  });

  it("leaves snacks and pre-workout open to both", () => {
    expect(isMealAppropriate(yogurt, "snack")).toBe(true);
    expect(isMealAppropriate(byId.get("chicken_breast")!, "snack")).toBe(true);
  });
});

describe("the lean-protein guard respects main_meal_ok", () => {
  // Greek yogurt is the leanest protein here by fat-per-gram-of-protein, so an
  // aggressive cut would swap it into meal_2/meal_3 if the guard's pool were
  // not filtered — "yogurt and rice for dinner".
  const yogurt = ing(
    "greek_yogurt",
    "protein",
    { protein: 10, carbs: 3.6, fat: 0.4, cal: 59 },
    ["dairy", "vegetarian"],
    false,
    true,
    false,
  );
  const byIdPlus = new Map(byId);
  byIdPlus.set(yogurt.id, yogurt);
  const bySlotPlus = new Map(bySlot);
  bySlotPlus.set("protein", [...(bySlot.get("protein") ?? []), yogurt]);

  it("never puts it in a main meal, however lean the target", () => {
    const meals = fillTemplate(
      SLOTS,
      // Fat-tight, protein-heavy: exactly the target that trips the guard.
      { calories: 1800, proteinG: 180, carbsG: 200, fatG: 40 },
      byIdPlus,
      bySlotPlus,
      baseConstraints,
    );
    for (const meal of meals) {
      if (meal.mealKey !== "meal_2" && meal.mealKey !== "meal_3" && meal.mealKey !== "last_meal") continue;
      expect(meal.items.map((i) => i.ingredientId)).not.toContain("greek_yogurt");
    }
  });
});

describe("selectTemplate", () => {
  it("returns a template even with tight constraints", () => {
    const templates: MealTemplate[] = [
      { id: "a", cookingTier: "fast", budgetTier: "low" },
      { id: "b", cookingTier: "normal", budgetTier: "high" },
    ];
    const slotsByTemplate = new Map<string, TemplateSlot[]>([
      ["a", SLOTS],
      ["b", SLOTS],
    ]);
    const chosen = selectTemplate(templates, slotsByTemplate, byId, { ...baseConstraints, budgetLevel: "low" }, "fast");
    // budget-compatible + cooking-match template wins.
    expect(chosen?.id).toBe("a");
  });
});
