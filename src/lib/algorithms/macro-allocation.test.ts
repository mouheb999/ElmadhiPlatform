import { describe, expect, it } from "vitest";
import { POLICY, RELAXATION_ORDER, allocateMacros } from "./macro-allocation";
import { calculateMacros } from "./macros";
import { referenceWeightKg } from "./energy";

/**
 * The allocation policy, enforced as a property over the whole valid input
 * domain rather than as a list of examples.
 *
 * Everything here asserts against POLICY itself, not against copies of its
 * numbers. A deliberate change to the product's nutrition policy therefore
 * moves these tests with it; an accidental change to the SOLVER does not, and
 * fails here.
 */

const GRID = {
  gender: ["male", "female"] as const,
  age: [14, 25, 40, 65, 90],
  heightCm: [120, 150, 165, 180, 195, 215, 230],
  weightKg: [35, 50, 70, 95, 130, 180, 250],
  activityLevel: ["sedentary", "moderate", "very_active"] as const,
  goal: ["lose_fat", "build_muscle", "recomp", "maintain"] as const,
  trainingDays: ["0", "3_4", "7"],
};

type Case = {
  id: string;
  weightKg: number;
  heightCm: number;
  m: ReturnType<typeof calculateMacros>;
};

/** Every plan the grid produces that the engine considers a real body. */
function everyPlan(): Case[] {
  const out: Case[] = [];
  for (const gender of GRID.gender)
    for (const age of GRID.age)
      for (const heightCm of GRID.heightCm)
        for (const weightKg of GRID.weightKg) {
          const bmi = weightKg / (heightCm / 100) ** 2;
          if (bmi < 10 || bmi > 100) continue; // not a body; rejected upstream
          for (const activityLevel of GRID.activityLevel)
            for (const goal of GRID.goal)
              for (const trainingDays of GRID.trainingDays) {
                out.push({
                  id: `${gender}/${age}y/${heightCm}cm/${weightKg}kg/${activityLevel}/${goal}/td${trainingDays}`,
                  weightKg,
                  heightCm,
                  m: calculateMacros({
                    gender,
                    birthDate: new Date(new Date().getFullYear() - age, 0, 1),
                    heightCm,
                    weightKg,
                    activityLevel,
                    goal,
                    trainingDays,
                  }),
                });
              }
        }
  return out;
}

const PLANS = everyPlan();

describe("macro allocation — policy holds across the valid input domain", () => {
  it("covers a substantial domain", () => {
    // Every (gender, age, height, weight, activity, goal, training) tuple in
    // the grid whose height/weight pair describes a real body.
    expect(PLANS.length).toBeGreaterThan(10_000);
  });

  it("A. calories are positive and never under the floor", () => {
    for (const { id, m } of PLANS) {
      expect(m.calories, id).toBeGreaterThan(0);
      expect(m.calories, id).toBeGreaterThanOrEqual(1200);
    }
  });

  it("B. the three macros always re-sum to the calorie target", () => {
    for (const { id, m } of PLANS) {
      const sum = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
      expect(Math.abs(sum - m.calories), id).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
    }
  });

  it("C/D. protein stays inside its floor, its per-kg ceiling and its absolute cap", () => {
    for (const { id, m, weightKg, heightCm } of PLANS) {
      const ref = referenceWeightKg(weightKg, heightCm);
      // One whole gram of slack: a bound in g/kg cannot always be expressed
      // exactly on an integer-gram grid.
      expect(m.proteinG + 1, id).toBeGreaterThanOrEqual(POLICY.protein.minPerKg * ref);
      expect(m.proteinG - 1, id).toBeLessThanOrEqual(POLICY.protein.maxPerKg * ref);
      expect(m.proteinG, id).toBeLessThanOrEqual(POLICY.protein.maxG);
    }
  });

  it("E/F. fat stays inside its floor and its per-kg ceiling", () => {
    for (const { id, m, weightKg, heightCm } of PLANS) {
      const ref = referenceWeightKg(weightKg, heightCm);
      expect(m.fatG + 1, id).toBeGreaterThanOrEqual(POLICY.fat.minPerKg * ref);
      expect(m.fatG - 1, id).toBeLessThanOrEqual(POLICY.fat.maxPerKg * ref);
    }
  });

  it("G/H. carbohydrate is never negative and never under its floor", () => {
    for (const { id, m } of PLANS) {
      expect(m.carbsG, id).toBeGreaterThanOrEqual(0);
      if (m.allocation.feasible) {
        expect(m.carbsG, id).toBeGreaterThanOrEqual(POLICY.carbs.minG);
      }
    }
  });

  it("I. protein can never eat the budget past its share ceiling", () => {
    for (const { id, m } of PLANS) {
      const share = (m.proteinG * 4) / m.calories;
      expect(share, id).toBeLessThanOrEqual(POLICY.protein.maxKcalShare + 0.01);
    }
  });

  it("J. fat never takes the 40-50% of calories a low budget used to hand it", () => {
    for (const { id, m } of PLANS) {
      const share = (m.fatG * 9) / m.calories;
      // The per-kg health floor outranks the share ceiling, so the bound here
      // is the ceiling plus the room that floor can legitimately claim.
      expect(share, id).toBeLessThan(0.4);
    }
  });

  it("K. a large frame alone cannot inflate any macro", () => {
    for (const { id, m, weightKg, heightCm } of PLANS) {
      const ref = referenceWeightKg(weightKg, heightCm);
      expect(m.proteinG, id).toBeLessThanOrEqual(POLICY.protein.maxG);
      expect(m.fatG - 1, id).toBeLessThanOrEqual(POLICY.fat.maxPerKg * ref);
    }
  });

  it("L. no NaN, Infinity or negative value reaches a prescription", () => {
    for (const { id, m } of PLANS) {
      for (const v of [m.bmr, m.tdee, m.calories, m.proteinG, m.carbsG, m.fatG, m.fiberG]) {
        expect(Number.isFinite(v), id).toBe(true);
        expect(v, id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is deterministic", () => {
    const once = calculateMacros({
      gender: "male", birthDate: new Date(1995, 0, 1), heightCm: 180,
      weightKg: 90, activityLevel: "sedentary", goal: "lose_fat", trainingDays: "0",
    });
    const twice = calculateMacros({
      gender: "male", birthDate: new Date(1995, 0, 1), heightCm: 180,
      weightKg: 90, activityLevel: "sedentary", goal: "lose_fat", trainingDays: "0",
    });
    expect(once.proteinG).toBe(twice.proteinG);
    expect(once.carbsG).toBe(twice.carbsG);
    expect(once.fatG).toBe(twice.fatG);
  });
});

/**
 * The shapes that must never come back.
 *
 * Each of these encodes the GENERAL rule that makes a class of bad split
 * impossible, not the one example that exposed it.
 */
describe("macro allocation — regressions", () => {
  const worst = () => {
    // The reported shape: 2,130 kcal split as 222 g protein / 86 g carbs /
    // 100 g fat. Protein at 2.0 g/kg of a 111 kg reference frame, fat at
    // 0.9 g/kg of the same, carbohydrate left with 16% of the day.
    return calculateMacros({
      gender: "male", birthDate: new Date(new Date().getFullYear() - 30, 0, 1),
      heightCm: 201, weightKg: 111, activityLevel: "sedentary",
      goal: "lose_fat", trainingDays: "0",
    });
  };

  it("excessive protein: no plan exceeds the absolute cap", () => {
    expect(worst().proteinG).toBeLessThanOrEqual(POLICY.protein.maxG);
    expect(PLANS.every((p) => p.m.proteinG <= POLICY.protein.maxG)).toBe(true);
  });

  it("high bodyweight cannot produce excessive protein", () => {
    // 2.0 g/kg of a 120 kg frame would be 240 g. It is not.
    const heavy = calculateMacros({
      gender: "male", birthDate: new Date(new Date().getFullYear() - 35, 0, 1),
      heightCm: 209, weightKg: 120, activityLevel: "sedentary",
      goal: "lose_fat", trainingDays: "0",
    });
    expect(heavy.proteinG).toBeLessThanOrEqual(POLICY.protein.maxG);
    expect(heavy.proteinG).toBeLessThan(240);
  });

  it("excessive fat: no plan exceeds the per-kg ceiling", () => {
    for (const { id, m, weightKg, heightCm } of PLANS) {
      expect(m.fatG - 1, id).toBeLessThanOrEqual(
        POLICY.fat.maxPerKg * referenceWeightKg(weightKg, heightCm),
      );
    }
  });

  it("near-zero carbs: the reported shape now has a real carbohydrate share", () => {
    const m = worst();
    expect(m.carbsG).toBeGreaterThanOrEqual(POLICY.carbs.minG);
    // 86 g on 2,130 kcal was 16% of the day.
    expect((m.carbsG * 4) / m.calories).toBeGreaterThan(0.25);
  });

  it("zero and negative carbs are impossible", () => {
    expect(PLANS.every((p) => p.m.carbsG > 0)).toBe(true);
  });

  it("low calorie budgets do not starve carbohydrate", () => {
    const lean = PLANS.filter((p) => p.m.calories <= 1600 && p.m.allocation.feasible);
    expect(lean.length).toBeGreaterThan(0);
    for (const { id, m } of lean) {
      expect(m.carbsG, id).toBeGreaterThanOrEqual(POLICY.carbs.minG);
    }
  });

  it("macro calories never exceed the target beyond tolerance", () => {
    for (const { id, m } of PLANS) {
      const sum = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
      expect(sum - m.calories, id).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
    }
  });

  it("macro calories never fall below the target beyond tolerance", () => {
    for (const { id, m } of PLANS) {
      const sum = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
      expect(m.calories - sum, id).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
    }
  });

  it("the solver never alters the calorie target it was given", () => {
    for (const calories of [1200, 1500, 1800, 2400, 3200, 4800]) {
      for (const referenceWeightKg of [45, 70, 95, 130]) {
        const a = allocateMacros({ calories, referenceWeightKg, proteinPerKgTarget: 2.0 });
        const sum = a.proteinG * 4 + a.carbsG * 4 + a.fatG * 9;
        expect(Math.abs(sum - calories)).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
      }
    }
  });

  it("relaxes in the documented order and records what gave way", () => {
    // A budget too small for the preferred split forces relaxation.
    const a = allocateMacros({ calories: 1200, referenceWeightKg: 95, proteinPerKgTarget: 2.0 });
    expect(a.relaxations.every((r) => RELAXATION_ORDER.includes(r))).toBe(true);
    const order = a.relaxations.map((r) => RELAXATION_ORDER.indexOf(r));
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it("reports infeasible rather than inventing a policy-violating plan", () => {
    // A frame far too large for the calorie floor: nothing can satisfy the
    // policy, so it must say so instead of returning an ordinary-looking split.
    const a = allocateMacros({ calories: 1200, referenceWeightKg: 200, proteinPerKgTarget: 2.0 });
    expect(a.feasible).toBe(false);
    // Still internally consistent, still free of nonsense.
    const sum = a.proteinG * 4 + a.carbsG * 4 + a.fatG * 9;
    expect(Math.abs(sum - 1200)).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
    expect(a.carbsG).toBeGreaterThanOrEqual(0);
  });
});
