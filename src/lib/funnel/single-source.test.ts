import { describe, expect, it } from "vitest";
import { differenceInYears } from "date-fns";
import { calculateFitnessPlan } from "./fitness-plan";
import { toDietPrefill, type FunnelAnswers } from "./answers";
import { calculateMacros } from "@/lib/algorithms/macros";
import { birthDateForAge } from "@/lib/algorithms/age";

/**
 * One questionnaire, one set of numbers, everywhere it is shown.
 *
 *   /start reveal  →  checkout recap  →  paid plan (macro_targets)  →  dashboard
 *
 * The first two call `calculateFitnessPlan`; the paid plan calls
 * `calculateMacros` from `submitDietQuestions` and stores the result; the
 * dashboard and every other in-app screen SELECT that stored row. So the whole
 * chain is identical if and only if the two entry points agree — which is what
 * this file checks, by reproducing the paid path's call exactly as
 * `actions/diet.ts` makes it.
 *
 * This is the property the funnel's honesty rests on: a reveal that promises
 * 2,310 kcal and a plan that delivers 2,100 is a bait-and-switch discovered in
 * week one by the first customer who compares the two screens.
 */

const ANSWERS: FunnelAnswers[] = [
  { goal: "lose_fat", gender: "male", age: 23, heightCm: 180, weightKg: 75, targetWeightKg: 68, trainingDays: "3_4", activityLevel: "moderate", mealsPerDay: 4, experience: "new", blocker: "what_to_eat" },
  { goal: "build_muscle", gender: "male", age: 31, heightCm: 176, weightKg: 68, targetWeightKg: 76, trainingDays: "5_6", activityLevel: "light", mealsPerDay: 5, experience: "consistent", blocker: "no_program" },
  { goal: "recomp", gender: "female", age: 27, heightCm: 165, weightKg: 62, targetWeightKg: 58, trainingDays: "3_4", activityLevel: "moderate", mealsPerDay: 3, experience: "returning", blocker: "motivation" },
  { goal: "lose_fat", gender: "female", age: 45, heightCm: 158, weightKg: 88, targetWeightKg: 70, trainingDays: "1_2", activityLevel: "sedentary", mealsPerDay: 3, experience: "new", blocker: "no_time" },
  { goal: "maintain", gender: "male", age: 60, heightCm: 172, weightKg: 79, targetWeightKg: 79, trainingDays: "0", activityLevel: "light", mealsPerDay: 4, experience: "returning", blocker: "stalled" },
];

/**
 * Exactly what `submitDietQuestions` does with the prefill the funnel hands it:
 * the same fields, through the same shared age helper, into the same engine.
 */
function paidPlanTargets(answers: FunnelAnswers) {
  const prefill = toDietPrefill(answers) as Record<string, never>;
  return calculateMacros({
    gender: prefill.gender,
    birthDate: birthDateForAge(prefill.age),
    heightCm: prefill.heightCm,
    weightKg: prefill.weightKg,
    activityLevel: prefill.activityLevel,
    goal: prefill.goal,
    trainingDays: prefill.trainingDays,
    bodyFatPercent: null,
  });
}

describe("single source of truth", () => {
  it("the reveal and the paid plan produce identical numbers", () => {
    for (const answers of ANSWERS) {
      const reveal = calculateFitnessPlan(answers).targets;
      const paid = paidPlanTargets(answers);
      const id = `${answers.gender}/${answers.age}/${answers.weightKg}kg/${answers.goal}`;
      expect(paid.bmr, id).toBe(reveal.bmr);
      expect(paid.tdee, id).toBe(reveal.tdee);
      expect(paid.calories, id).toBe(reveal.calories);
      expect(paid.proteinG, id).toBe(reveal.proteinG);
      expect(paid.carbsG, id).toBe(reveal.carbsG);
      expect(paid.fatG, id).toBe(reveal.fatG);
      expect(paid.fiberG, id).toBe(reveal.fiberG);
    }
  });

  it("the checkout recap shows the same numbers as the reveal", () => {
    // Both components call calculateFitnessPlan with the same cookie answers,
    // so this is really a determinism check on the same input — which is the
    // property that matters, since they render on different routes.
    for (const answers of ANSWERS) {
      const a = calculateFitnessPlan(answers).targets;
      const b = calculateFitnessPlan(answers).targets;
      expect(a.calories).toBe(b.calories);
      expect([a.proteinG, a.carbsG, a.fatG]).toEqual([b.proteinG, b.carbsG, b.fatG]);
    }
  });

  it("the funnel's prefill carries every field the engine reads", () => {
    // If a field the engine reads went missing from the prefill, the paid plan
    // would silently fall back to a default and diverge from the reveal.
    const prefill = toDietPrefill(ANSWERS[0]);
    for (const key of ["gender", "age", "heightCm", "weightKg", "activityLevel", "goal", "trainingDays"]) {
      expect(prefill[key], key).toBeDefined();
    }
  });

  it("every path derives the same age from the same answer", () => {
    // The three spellings this replaced agreed today and were not guaranteed to.
    for (const age of [18, 23, 40, 67, 90]) {
      expect(differenceInYears(new Date(), birthDateForAge(age))).toBe(age);
    }
  });

  it("training frequency reaches the paid plan, not just the reveal", () => {
    const base = ANSWERS[0];
    const none = paidPlanTargets({ ...base, trainingDays: "0" });
    const lots = paidPlanTargets({ ...base, trainingDays: "7" });
    expect(lots.tdee).toBeGreaterThan(none.tdee);
    expect(calculateFitnessPlan({ ...base, trainingDays: "7" }).targets.tdee).toBe(lots.tdee);
  });
});
