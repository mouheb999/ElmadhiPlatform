import { describe, expect, it } from "vitest";
import { calculateMacros } from "./macros";
import { resolveGoalStrategy } from "./diet-strategy";
import {
  fillTemplate,
  mealPlanForDay,
  isIngredientAllowed,
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
  dailySteps: "unknown" as const,
};

describe("calculateMacros", () => {
  it("uses Mifflin BMR and the activity factor for TDEE", () => {
    const m = calculateMacros({ ...maleProfile, goal: "maintain", bodyFatLevel: "normal" });
    // 10*80 + 6.25*180 - 5*25 + 5 = 1805; * 1.55 = 2797.75
    expect(m.bmr).toBe(1805);
    expect(m.tdee).toBe(2798);
  });

  it("maintain sits at TDEE", () => {
    const m = calculateMacros({ ...maleProfile, goal: "maintain", bodyFatLevel: "normal" });
    expect(m.calories).toBe(m.tdee);
  });

  it("cut at normal body fat applies a ~20% deficit", () => {
    const m = calculateMacros({ ...maleProfile, goal: "lose_fat", bodyFatLevel: "normal" });
    expect(m.calories).toBe(Math.round(m.tdee * 0.8));
    // protein 2.1 g/kg at mid body fat → 168 g for 80 kg
    expect(m.proteinG).toBe(168);
  });

  it("follows the formula order: carbs are the remainder, fiber from final calories", () => {
    const m = calculateMacros({ ...maleProfile, goal: "recomp", bodyFatLevel: "normal" });
    const remainder = Math.round((m.calories - m.proteinG * 4 - m.fatG * 9) / 4);
    expect(m.carbsG).toBe(remainder);
    expect(m.fiberG).toBe(Math.round((m.calories / 1000) * 14));
  });

  it("never lets fat fall below 0.5 g/kg", () => {
    const m = calculateMacros({ ...maleProfile, goal: "lose_fat", bodyFatLevel: "high" });
    expect(m.fatG).toBeGreaterThanOrEqual(Math.round(0.5 * maleProfile.weightKg));
  });

  it("higher body fat deepens the cut", () => {
    const lean = calculateMacros({ ...maleProfile, goal: "lose_fat", bodyFatLevel: "very_lean" });
    const fat = calculateMacros({ ...maleProfile, goal: "lose_fat", bodyFatLevel: "high" });
    expect(fat.calories).toBeLessThan(lean.calories);
  });
});

describe("resolveGoalStrategy", () => {
  it("keeps every goal's numbers inside the sheet ranges", () => {
    const cut = resolveGoalStrategy("lose_fat", "normal");
    expect(cut.calorieFactor).toBeGreaterThanOrEqual(-0.25);
    expect(cut.calorieFactor).toBeLessThanOrEqual(-0.15);
    expect(cut.proteinPerKg).toBeGreaterThanOrEqual(1.8);
    expect(cut.proteinPerKg).toBeLessThanOrEqual(2.4);

    const bulk = resolveGoalStrategy("build_muscle", "normal");
    expect(bulk.calorieFactor).toBeGreaterThanOrEqual(0.1);
    expect(bulk.calorieFactor).toBeLessThanOrEqual(0.15);
  });
});

// ---- template fill ----

const ING: Ingredient[] = [
  ing("chicken_breast", "protein", { protein: 31, carbs: 0, fat: 3.6, cal: 165 }, ["poultry"], true),
  ing("tuna", "protein", { protein: 26, carbs: 0, fat: 1, cal: 116 }, ["fish"], false),
  ing("eggs", "protein", { protein: 13, carbs: 1.1, fat: 10, cal: 143 }, ["egg", "vegetarian"], false),
  ing("white_rice", "carb", { protein: 2.7, carbs: 28, fat: 0.3, cal: 130 }, ["vegetarian"], true),
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
