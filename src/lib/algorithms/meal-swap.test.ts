import { describe, expect, it } from "vitest";
import { contributionOf, dominantMacro, swapQuantityG, type SwapFood } from "./meal-swap";

// Values in the shape of the real nutrition_ingredients catalog.
const chicken: SwapFood = { caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 };
const turkey: SwapFood = { caloriesPer100g: 135, proteinPer100g: 29, carbsPer100g: 0, fatPer100g: 1.7 };
const rice: SwapFood = { caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 };
const pasta: SwapFood = { caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1 };
const oliveOil: SwapFood = { caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 };
const peanuts: SwapFood = { caloriesPer100g: 567, proteinPer100g: 26, carbsPer100g: 16, fatPer100g: 49 };
const coffee: SwapFood = { caloriesPer100g: 2, proteinPer100g: 0.1, carbsPer100g: 0, fatPer100g: 0 };
const water: SwapFood = { caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 };

describe("dominantMacro", () => {
  it("reads a lean protein as protein", () => {
    expect(dominantMacro(chicken)).toBe("protein");
  });

  it("reads a starch as carbs", () => {
    expect(dominantMacro(rice)).toBe("carbs");
  });

  it("reads oil as fat", () => {
    expect(dominantMacro(oliveOil)).toBe("fat");
  });

  it("weights fat at 9 kcal/g — peanuts are a fat, not a protein", () => {
    // 26g protein = 104 kcal, 49g fat = 441 kcal
    expect(dominantMacro(peanuts)).toBe("fat");
  });

  it("returns null for a food carrying nothing measurable", () => {
    expect(dominantMacro(water)).toBeNull();
  });
});

describe("swapQuantityG", () => {
  it("preserves protein exactly when swapping protein for protein", () => {
    const grams = swapQuantityG(chicken, 150, turkey);
    const before = contributionOf(chicken, 150).proteinG;
    const after = contributionOf(turkey, grams).proteinG;
    // 150g chicken = 46.5g protein; 46.5 / 29 * 100 = 160g turkey
    expect(grams).toBe(160);
    expect(after).toBeCloseTo(before, 0);
  });

  it("preserves carbs exactly when swapping carb for carb", () => {
    const grams = swapQuantityG(rice, 200, pasta);
    const before = contributionOf(rice, 200).carbsG;
    const after = contributionOf(pasta, grams).carbsG;
    expect(after).toBeCloseTo(before, 0);
  });

  it("keeps calories close on a same-slot swap", () => {
    const grams = swapQuantityG(rice, 200, pasta);
    const before = contributionOf(rice, 200).calories;
    const after = contributionOf(pasta, grams).calories;
    // Same dominant macro → calories track within a small margin.
    expect(Math.abs(after - before) / before).toBeLessThan(0.15);
  });

  it("is reversible — swapping back restores the original portion", () => {
    const out = swapQuantityG(chicken, 150, turkey);
    const back = swapQuantityG(turkey, out, chicken);
    expect(Math.abs(back - 150)).toBeLessThanOrEqual(1);
  });

  it("falls back to calorie matching when the replacement lacks the macro", () => {
    // Oil is pure fat; rice has none — match on calories instead.
    const grams = swapQuantityG(oliveOil, 20, rice);
    const before = contributionOf(oliveOil, 20).calories;
    const after = contributionOf(rice, grams).calories;
    expect(after).toBeCloseTo(before, 0);
  });

  it("keeps the portion when neither food carries anything", () => {
    expect(swapQuantityG(water, 250, water)).toBe(250);
  });

  it("keeps a near-free food's portion sane rather than exploding it", () => {
    // Coffee → water: coffee's dominant macro is a trace of protein that water
    // lacks, and water has no calories either, so the portion carries over.
    expect(swapQuantityG(coffee, 200, water)).toBe(200);
  });

  it("clamps to the solver's portion bounds", () => {
    // A tiny amount of oil vs. a low-density vegetable would round to <15g.
    expect(swapQuantityG(oliveOil, 5, peanuts)).toBeGreaterThanOrEqual(15);
    // A huge protein portion swapped into a weak protein source stays <=500g.
    expect(swapQuantityG(chicken, 500, coffee)).toBeLessThanOrEqual(500);
  });

  it("rounds to whole grams", () => {
    const grams = swapQuantityG(chicken, 137, turkey);
    expect(Number.isInteger(grams)).toBe(true);
  });
});
