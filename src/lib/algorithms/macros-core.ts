/**
 * The pieces both `macros.ts` and `energy.ts` need.
 *
 * Extracted for one reason: `macros.ts` now gets its calorie target from
 * `energy.ts`, and `energy.ts` needs the resting-metabolism formula. Left where
 * they were, those two would import each other. Nothing here changed when it
 * moved — same formula, same constants, same exported names, and `macros.ts`
 * re-exports them so every existing import site is untouched.
 */

/** kcal per gram. */
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

/**
 * Q6 — how the user's DAY looks. The factors these keys are worth live in
 * `energy.ts`, which is also where training frequency is added on top.
 */
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

/** A body-fat percentage we will actually believe. Anything else is ignored. */
export function isUsableBodyFatPercent(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 3 && value <= 60;
}

/**
 * Resting energy expenditure — Mifflin-St Jeor.
 *
 *   male:   10·kg + 6.25·cm − 5·age + 5
 *   female: 10·kg + 6.25·cm − 5·age − 161
 *
 * Mifflin uses height and age as stand-ins for how much lean tissue a person is
 * carrying. When the actual body-fat percentage is known those stand-ins are not
 * needed: lean mass is the thing that burns, so `500 + 22 × LBM` reads it
 * directly. Two people of the same height, age and weight get the same Mifflin
 * number and can have very different requirements; this is the input that tells
 * them apart.
 */
export function restingEnergy(input: {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number | null;
}): { value: number; usedLeanMass: boolean } {
  if (isUsableBodyFatPercent(input.bodyFatPercent)) {
    const leanMassKg = input.weightKg * (1 - input.bodyFatPercent / 100);
    return { value: 500 + 22 * leanMassKg, usedLeanMass: true };
  }
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return { value: input.gender === "male" ? base + 5 : base - 161, usedLeanMass: false };
}
