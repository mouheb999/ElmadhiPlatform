import { describe, expect, it } from "vitest";
import { calculateFitnessPlan, HORIZON_WEEKS, type FitnessPlanInput } from "./fitness-plan";
import { resolveEnergyPlan } from "@/lib/algorithms/energy";

const MALE: FitnessPlanInput = {
  goal: "lose_fat",
  gender: "male",
  age: 23,
  heightCm: 180,
  weightKg: 75,
  targetWeightKg: 68,
  activityLevel: "moderate",
  trainingDays: "3_4",
};

/** Every number a screen prints, so one assertion covers "no NaN anywhere". */
function finiteNumbers(plan: ReturnType<typeof calculateFitnessPlan>): number[] {
  const t = plan.targets;
  return [
    t.bmr, t.tdee, t.calories, t.proteinG, t.carbsG, t.fatG, t.fiberG,
    plan.weeklyRateKg, plan.weeklyRatePercent,
    ...plan.timeline.flatMap((p) => [p.week, p.kg, p.lowKg, p.highKg, p.deltaKg]),
  ];
}

describe("calculateFitnessPlan — the two bugs on the reported screenshot", () => {
  /**
   * The headline symptom: "75.0 kg today / 75.0 kg after 12 weeks" three times
   * over, with "0.0 kg/week" beside it.
   *
   * Two independent causes, both reachable from the live questionnaire because
   * goal and target weight are asked as separate questions with no cross-check:
   * a recomp whose calorie factor rounded to maintenance, and any contradictory
   * goal/target pair, which made the old milestone lookup fall back to the last
   * point three times.
   */
  it("never reports a zero rate for a goal that expects movement", () => {
    for (const goal of ["lose_fat", "build_muscle", "recomp"] as const) {
      const plan = calculateFitnessPlan({ ...MALE, goal });
      expect(plan.kind).toBe("scale");
      expect(Math.abs(plan.weeklyRateKg)).toBeGreaterThan(0.01);
    }
  });

  it("gives every horizon its own date", () => {
    for (const goal of ["lose_fat", "build_muscle", "recomp", "maintain"] as const) {
      const plan = calculateFitnessPlan({ ...MALE, goal });
      const days = plan.timeline.map((p) => p.date.toISOString().slice(0, 10));
      expect(new Set(days).size).toBe(HORIZON_WEEKS.length);
    }
  });

  it("dates the horizons exactly 0/4/8/12 weeks from today", () => {
    const plan = calculateFitnessPlan(MALE);
    const day = 86_400_000;
    const t0 = plan.timeline[0].date.getTime();
    expect(plan.timeline.map((p) => Math.round((p.date.getTime() - t0) / day))).toEqual([0, 28, 56, 84]);
  });

  it("moves the weight at every horizon when the goal expects movement", () => {
    const plan = calculateFitnessPlan(MALE);
    const kgs = plan.timeline.map((p) => p.kg.toFixed(1));
    expect(new Set(kgs).size).toBe(kgs.length);
  });

  /**
   * "Build muscle" with a target weight BELOW today's. The old engine broke out
   * of its walk on week one and rendered week 12 three times under three
   * labels. It now follows the goal and flags the contradiction for the screen
   * to explain.
   */
  it("follows the goal — and says so — when the target weight contradicts it", () => {
    const plan = calculateFitnessPlan({ ...MALE, goal: "build_muscle", targetWeightKg: 70 });
    expect(plan.targetContradictsGoal).toBe(true);
    expect(plan.direction).toBe("up");
    expect(plan.timeline.at(-1)!.kg).toBeGreaterThan(75);
    expect(new Set(plan.timeline.map((p) => p.date.getTime())).size).toBe(4);
  });

  it("does the same for a cut aimed at a higher target", () => {
    const plan = calculateFitnessPlan({ ...MALE, goal: "lose_fat", targetWeightKg: 85 });
    expect(plan.targetContradictsGoal).toBe(true);
    expect(plan.direction).toBe("down");
  });
});

describe("calculateFitnessPlan — the calories and the rate are one decision", () => {
  /**
   * The invariant the whole rewrite exists to hold. The rate is not an opinion
   * about the calories, it is the calories: balance × 7 ÷ 7700.
   */
  it("derives the shown rate from the shown calorie target", () => {
    for (const goal of ["lose_fat", "build_muscle", "recomp"] as const) {
      for (const weightKg of [55, 75, 120, 160]) {
        const plan = calculateFitnessPlan({ ...MALE, goal, weightKg, targetWeightKg: weightKg - 8 });
        const implied = ((plan.targets.calories - plan.targets.tdee) * 7) / 7700;
        expect(plan.weeklyRateKg).toBeCloseTo(implied, 6);
      }
    }
  });

  it("is the same engine the paid plan is built from", () => {
    const plan = calculateFitnessPlan(MALE);
    const energy = resolveEnergyPlan({
      gender: MALE.gender,
      age: MALE.age,
      heightCm: MALE.heightCm,
      weightKg: MALE.weightKg,
      activityLevel: MALE.activityLevel,
      goal: MALE.goal,
      trainingDays: MALE.trainingDays,
    });
    expect(plan.targets.calories).toBe(energy.calories);
    expect(plan.targets.tdee).toBe(energy.tdee);
    expect(plan.targets.bmr).toBe(energy.bmr);
  });

  it("splits the macros back into roughly the calorie target", () => {
    for (const goal of ["lose_fat", "build_muscle", "recomp", "maintain"] as const) {
      for (const weightKg of [50, 75, 100, 140]) {
        const { targets } = calculateFitnessPlan({ ...MALE, goal, weightKg, targetWeightKg: weightKg - 5 });
        const fromMacros = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;
        // Rounding each macro to a whole gram cannot drift further than this.
        expect(Math.abs(fromMacros - targets.calories)).toBeLessThanOrEqual(15);
      }
    }
  });
});

describe("calculateFitnessPlan — the user's test cases", () => {
  it("1. 75kg male, 180cm, 23y, moderate, fat loss", () => {
    const p = calculateFitnessPlan(MALE);
    expect(p.targets.bmr).toBe(1765); // 10·75 + 6.25·180 − 5·23 + 5
    expect(p.targets.calories).toBeGreaterThan(2000);
    expect(p.targets.calories).toBeLessThan(p.targets.tdee);
    expect(p.weeklyRatePercent).toBeGreaterThanOrEqual(0.45);
    expect(p.weeklyRatePercent).toBeLessThanOrEqual(0.8);
  });

  it("2. 60kg female, 165cm, 25y, moderate, fat loss", () => {
    const p = calculateFitnessPlan({
      ...MALE, gender: "female", age: 25, heightCm: 165, weightKg: 60, targetWeightKg: 55,
    });
    expect(p.targets.bmr).toBe(1345); // 10·60 + 6.25·165 − 5·25 − 161
    expect(p.targets.calories).toBeGreaterThanOrEqual(1200);
    expect(p.direction).toBe("down");
  });

  it("3. 90kg male, sedentary, fat loss — a real deficit, not a token one", () => {
    const p = calculateFitnessPlan({
      ...MALE, weightKg: 90, targetWeightKg: 78, activityLevel: "sedentary", trainingDays: "0",
    });
    expect(p.weeklyRatePercent).toBeGreaterThanOrEqual(0.45);
    expect(p.targets.calories).toBeGreaterThanOrEqual(1500);
  });

  it("4. 75kg male, muscle gain — a conservative surplus", () => {
    const p = calculateFitnessPlan({ ...MALE, goal: "build_muscle", targetWeightKg: 82 });
    expect(p.targets.calories).toBeGreaterThan(p.targets.tdee);
    expect(p.targets.calories / p.targets.tdee).toBeLessThanOrEqual(1.11);
    expect(p.weeklyRateKg).toBeGreaterThan(0);
    expect(p.weeklyRateKg).toBeLessThanOrEqual(0.35);
  });

  it("5. 75kg male, recomp — maintenance to a modest deficit, protein held high", () => {
    const p = calculateFitnessPlan({ ...MALE, goal: "recomp", targetWeightKg: 72 });
    expect(p.targets.calories).toBeLessThanOrEqual(p.targets.tdee);
    expect(p.targets.calories / p.targets.tdee).toBeGreaterThanOrEqual(0.92);
    expect(p.targets.proteinG / 75).toBeGreaterThanOrEqual(1.6);
    expect(p.targets.proteinG / 75).toBeLessThanOrEqual(2.2);
  });

  it("6. invalid and missing input is refused and carries NO prescription", () => {
    // Changed deliberately from "produces a usable plan": a refused plan that
    // still holds a plausible calorie target has invented a person, and a screen
    // that forgets to check `valid` would show them that number.
    for (const input of [
      { ...MALE, age: 0, heightCm: 0, weightKg: -5, targetWeightKg: Number.NaN },
      {} as FitnessPlanInput,
    ]) {
      const p = calculateFitnessPlan(input);
      expect(p.valid).toBe(false);
      for (const n of finiteNumbers(p)) expect(Number.isFinite(n)).toBe(true);
      expect(p.targets.calories).toBe(0);
      expect(p.targets.proteinG).toBe(0);
      expect(p.targets.carbsG).toBe(0);
      expect(p.targets.fatG).toBe(0);
      expect(p.timeline).toHaveLength(4);
    }
  });
});

describe("calculateFitnessPlan — edges and safety", () => {
  it("produces no NaN, no negative and no impossible weight across a wide sweep", () => {
    for (const gender of ["male", "female"] as const) {
      // 18 is the youngest this engine will act on at all — see MIN_ADULT_AGE.
      for (const age of [18, 25, 60, 90]) {
        for (const heightCm of [140, 165, 200]) {
          for (const weightKg of [38, 70, 140, 250]) {
            for (const goal of ["lose_fat", "build_muscle", "recomp", "maintain"] as const) {
              const p = calculateFitnessPlan({
                goal, gender, age, heightCm, weightKg,
                targetWeightKg: weightKg - 10,
                activityLevel: "light",
                trainingDays: "3_4",
              });
              for (const n of finiteNumbers(p)) expect(Number.isFinite(n)).toBe(true);
              expect(new Set(p.timeline.map((x) => x.date.getTime())).size).toBe(4);
              if (!p.valid) continue; // refused plans carry no prescription
              expect(p.targets.calories).toBeGreaterThan(0);
              expect(p.targets.carbsG).toBeGreaterThan(0);
              expect(p.targets.fatG).toBeGreaterThan(0);
              expect(p.timeline.every((x) => x.kg > 0 && x.lowKg > 0)).toBe(true);
            }
          }
        }
      }
    }
  });

  it("never walks anybody below a BMI of 18.5", () => {
    const p = calculateFitnessPlan({
      ...MALE, weightKg: 62, targetWeightKg: 45, heightCm: 180,
    });
    const floor = 18.5 * 1.8 * 1.8;
    expect(p.timeline.every((x) => x.lowKg >= floor - 0.001)).toBe(true);
  });

  /**
   * Replaces "holds a minor at maintenance". Holding them at maintenance still
   * meant running the adult model on a growing body and printing the result.
   * There is no pediatric model here, so the engine refuses outright.
   */
  it("refuses under-18s outright rather than softening the adult plan", () => {
    for (const age of [10, 14, 16, 17]) {
      const p = calculateFitnessPlan({
        ...MALE, age, gender: "female", heightCm: 165, weightKg: 60, targetWeightKg: 50,
      });
      expect(p.valid, `age ${age}`).toBe(false);
      expect(p.invalidReason, `age ${age}`).toBe("adult_nutrition_not_supported");
      expect(p.state, `age ${age}`).toBe("professional_assessment");
      // No adult arithmetic was run, so there is nothing to leak.
      expect(p.targets.bmr, `age ${age}`).toBe(0);
      expect(p.targets.calories, `age ${age}`).toBe(0);
    }
    expect(calculateFitnessPlan({ ...MALE, age: 18 }).valid).toBe(true);
  });

  it("holds an underweight body at maintenance too", () => {
    const p = calculateFitnessPlan({
      ...MALE, gender: "female", age: 25, heightCm: 170, weightKg: 49, targetWeightKg: 45,
    });
    expect(p.guidance).toBe("underweight");
    expect(p.targets.calories).toBe(p.targets.tdee);
  });

  it("does not gate a healthy adult", () => {
    expect(calculateFitnessPlan(MALE).guidance).toBeNull();
  });

  it("treats maintenance as a flat line, which is the correct answer for it", () => {
    const p = calculateFitnessPlan({ ...MALE, goal: "maintain", targetWeightKg: 75 });
    expect(p.kind).toBe("recomposition");
    expect(p.direction).toBe("hold");
    expect(new Set(p.timeline.map((x) => x.date.getTime())).size).toBe(4);
  });

  it("widens the range as the horizon gets further out", () => {
    const p = calculateFitnessPlan(MALE);
    const widths = p.timeline.map((x) => x.highKg - x.lowKg);
    expect(widths[0]).toBe(0);
    expect(widths[1]).toBeLessThan(widths[2]);
    expect(widths[2]).toBeLessThan(widths[3]);
  });
});

describe("resolveEnergyPlan — training frequency is read", () => {
  const base = {
    gender: "male" as const, age: 30, heightCm: 180, weightKg: 90,
    activityLevel: "sedentary" as const, goal: "lose_fat" as const,
  };

  it("raises TDEE with training frequency", () => {
    const none = resolveEnergyPlan({ ...base, trainingDays: "0" }).tdee;
    const some = resolveEnergyPlan({ ...base, trainingDays: "3_4" }).tdee;
    const lots = resolveEnergyPlan({ ...base, trainingDays: "7" }).tdee;
    expect(some).toBeGreaterThan(none);
    expect(lots).toBeGreaterThan(some);
    // And never by more than a tenth, which is what six sessions is worth.
    expect(lots / none).toBeLessThanOrEqual(1.09);
  });

  it("does not leave a desk worker who trains six times a week on the bottom factor", () => {
    const desk = resolveEnergyPlan({ ...base, trainingDays: "0" }).activityFactor;
    const lifts = resolveEnergyPlan({ ...base, trainingDays: "5_6" }).activityFactor;
    expect(lifts).toBeGreaterThan(desk);
  });

  it("falls back rather than throwing on an unknown activity level or goal", () => {
    const p = resolveEnergyPlan({
      ...base,
      activityLevel: "teleporting" as never,
      goal: "vibes" as never,
      trainingDays: "nonsense",
    });
    expect(Number.isFinite(p.calories)).toBe(true);
    expect(p.calories).toBeGreaterThan(0);
    expect(p.direction).toBe("hold"); // unknown goal → maintenance
  });
});

/**
 * Incomplete answers must not become somebody's calorie prescription.
 *
 * The clamping in this engine exists so that nonsense cannot crash a page or
 * produce NaN. It is emphatically NOT permission to present the result: a
 * missing weight clamps to 70 kg and yields a confident, ordinary-looking 2,230
 * kcal target, and that number is fiction about a person we know nothing about.
 * `valid` is the flag that separates the two, and the reveal refuses to render
 * anything when it is false.
 */
describe("calculateFitnessPlan — incomplete data cannot look like a plan", () => {
  const COMPLETE: FitnessPlanInput = {
    goal: "lose_fat", gender: "male", age: 23, heightCm: 180, weightKg: 75,
    targetWeightKg: 68, activityLevel: "moderate", trainingDays: "3_4",
  };

  it("accepts a complete set of answers", () => {
    const p = calculateFitnessPlan(COMPLETE);
    expect(p.valid).toBe(true);
    expect(p.invalidReason).toBeNull();
  });

  it("rejects an empty object", () => {
    const p = calculateFitnessPlan({} as FitnessPlanInput);
    expect(p.valid).toBe(false);
    expect(p.invalidReason).toBe("missing_required_inputs");
  });

  it("rejects each required answer being absent, one at a time", () => {
    for (const key of ["gender", "age", "heightCm", "weightKg", "activityLevel", "goal"] as const) {
      const partial = { ...COMPLETE, [key]: undefined } as unknown as FitnessPlanInput;
      const p = calculateFitnessPlan(partial);
      expect(p.valid, `missing ${key} was accepted`).toBe(false);
      expect(p.invalidReason, key).toBe("missing_required_inputs");
    }
  });

  it("treats NaN and null as missing rather than as numbers", () => {
    for (const bad of [Number.NaN, null, undefined]) {
      const p = calculateFitnessPlan({ ...COMPLETE, weightKg: bad as never });
      expect(p.valid).toBe(false);
      expect(p.invalidReason).toBe("missing_required_inputs");
    }
  });

  it("separates impossible values from missing ones", () => {
    for (const bad of [{ weightKg: -5 }, { weightKg: 0 }, { heightCm: 0 }, { age: -1 }, { heightCm: 400 }]) {
      const p = calculateFitnessPlan({ ...COMPLETE, ...bad });
      expect(p.valid, JSON.stringify(bad)).toBe(false);
      expect(p.invalidReason, JSON.stringify(bad)).toBe("impossible_values");
    }
  });

  it("rejects a height and weight that cannot describe one body", () => {
    // Each field is individually plausible; 35 kg at 210 cm is a BMI of 7.9.
    const p = calculateFitnessPlan({ ...COMPLETE, heightCm: 210, weightKg: 35 });
    expect(p.valid).toBe(false);
    expect(p.invalidReason).toBe("impossible_values");
  });

  it("does not require a target weight — calories do not depend on one", () => {
    const p = calculateFitnessPlan({ ...COMPLETE, targetWeightKg: undefined as never });
    expect(p.valid).toBe(true);
    expect(p.targets.calories).toBeGreaterThan(0);
  });

  it("still returns a structurally complete, NaN-free object when invalid", () => {
    // So a caller that forgets to check `valid` cannot crash — it just must not
    // show these numbers.
    const p = calculateFitnessPlan({} as FitnessPlanInput);
    for (const n of finiteNumbers(p)) expect(Number.isFinite(n)).toBe(true);
    expect(p.timeline).toHaveLength(4);
  });

  it("accepts the questionnaire's own extremes, so the gate is not over-eager", () => {
    // LIMITS in answers.ts: 14-90 years, 120-230 cm, 35-250 kg — narrowed to
    // 18+ by MIN_ADULT_AGE. Every corner of that box which describes a real
    // adult body whose maintenance clears the safety floor must produce a plan.
    for (const age of [18, 90])
      for (const heightCm of [150, 190])
        for (const weightKg of [55, 120]) {
          const p = calculateFitnessPlan({ ...COMPLETE, age, heightCm, weightKg, targetWeightKg: weightKg - 5 });
          expect(p.valid, `${age}/${heightCm}/${weightKg}`).toBe(true);
        }
  });
});
