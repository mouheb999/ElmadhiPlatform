import { differenceInYears } from "date-fns";
import { resolveGoalStrategy, type Bilingual, type Goal } from "./diet-strategy";
import { allocateMacros, type Allocation } from "./macro-allocation";
import {
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  isUsableBodyFatPercent,
  restingEnergy,
  type ActivityLevel,
} from "./macros-core";
export { POLICY as MACRO_POLICY } from "./macro-allocation";
import {
  CALORIE_FLOOR,
  referenceWeightKg,
  resolveEnergyPlan,
  type EnergyPlan,
  type Pace,
} from "./energy";

/**
 * Macros for a goal — the split, not the size of the budget.
 *
 * The calorie target, the TDEE behind it and the weekly rate it implies are all
 * decided in `energy.ts` now, and this file asks for them rather than computing
 * a parallel set. That is the point of the split: the reveal on /start, the
 * checkout recap and the plan a customer gets after paying all run through
 * `calculateMacros`, so there is exactly one number and no screen can contradict
 * another. What stayed here is everything downstream of the budget — protein,
 * fat, carbs, fiber and the sentences that explain them.
 *
 * Formula order: calories (energy.ts) → protein → fat → carbs (remainder) → fiber.
 */

// Re-exported so every existing import of these from "@/lib/algorithms/macros"
// keeps resolving. They live in macros-core.ts to keep energy.ts from importing
// this file while this file imports it.
export {
  KCAL_PER_G_PROTEIN,
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  isUsableBodyFatPercent,
  restingEnergy,
  CALORIE_FLOOR,
};
export type { ActivityLevel };

export type MacroProfileInput = {
  gender: "male" | "female";
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /**
   * Q5 — "0" | "1_2" | "3_4" | "5_6" | "7". Already collected by both the funnel
   * and the paid questionnaire; it feeds the TDEE as a training increment on
   * top of daily activity. Optional so a caller that has not got it still gets
   * the activity-only estimate rather than a crash.
   */
  trainingDays?: string | null;
  /** Desired speed, if it is ever asked for. Absent means the standard pace. */
  pace?: Pace | null;
  /**
   * Q9, optional. A MEASURED percentage (caliper, scan, scale) — not the
   * self-reported body-type category, which no longer feeds any number. When
   * present, resting metabolism is computed from lean mass instead of from
   * height and age, which is the more accurate of the two.
   */
  bodyFatPercent?: number | null;
};

export type MacroTargets = {
  /** Resting energy: Mifflin-St Jeor, or the lean-mass RMR when body fat is known. */
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** True when `bmr` above came from lean mass rather than Mifflin-St Jeor. */
  usedLeanMass: boolean;
  /**
   * The energy decision these macros were split out of: the balance, the weekly
   * rate it implies, and any safety flag. Carried here so the projection reads
   * the same numbers the plan was built from instead of inferring them back out
   * of the calorie total — which is the inference that produced "0.0 kg/week".
   */
  energy: EnergyPlan;
  /**
   * How the split went: whether the policy could be satisfied, and which
   * constraints gave way. `feasible: false` means this budget cannot hold a
   * normal plan and the caller must say so rather than present it as one.
   */
  allocation: Allocation;
  goalLabel: Bilingual;
  rationale: {
    bmr: Bilingual;
    tdee: Bilingual;
    target: Bilingual;
    protein: Bilingual;
    fat: Bilingual;
    carbs: Bilingual;
  };
};

export function calculateMacros(input: MacroProfileInput): MacroTargets {
  const age = differenceInYears(new Date(), input.birthDate);
  const w = input.weightKg;

  // 1-6. Resting energy, activity and training, and the calorie target the goal
  // implies — one decision, taken in energy.ts. This function no longer has its
  // own opinion about any of them, which is what stops the reveal and the paid
  // plan from drifting apart.
  const energy = resolveEnergyPlan({
    gender: input.gender,
    age,
    heightCm: input.heightCm,
    weightKg: w,
    activityLevel: input.activityLevel,
    goal: input.goal,
    trainingDays: input.trainingDays,
    bodyFatPercent: input.bodyFatPercent,
    pace: input.pace,
  });
  const { bmr, tdee, calories, usedLeanMass } = energy;

  const strategy = resolveGoalStrategy(input.goal);

  // 7. The split. The calorie target above is handed over unchanged and comes
  // back divided — see macro-allocation.ts, which owns every bound and the
  // order they give way in. This function has no opinion about any of them.
  const refKg = referenceWeightKg(w, input.heightCm);
  const allocation = allocateMacros({
    calories,
    referenceWeightKg: refKg,
    proteinPerKgTarget: strategy.proteinPerKg,
  });
  const { proteinG, fatG, carbsG } = allocation;

  // Fiber from final calories.
  const fiberG = Math.round((calories / 1000) * 14);

  const delta = energy.energyBalanceKcal;
  const roundedBmr = bmr;

  return {
    bmr: roundedBmr,
    tdee,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    usedLeanMass,
    energy,
    allocation,
    goalLabel: strategy.label,
    rationale: {
      bmr: usedLeanMass
        ? {
            en: `From your body fat, you carry about ${Math.round(w * (1 - (input.bodyFatPercent as number) / 100))} kg of lean mass — that burns around ${roundedBmr} kcal a day at rest.`,
            ar: `من نسبة الدهون لديك، تحمل حوالي ${Math.round(w * (1 - (input.bodyFatPercent as number) / 100))} كيلو كتلة صافية — تحرق حوالي ${roundedBmr} سعرة في اليوم وأنت في الراحة.`,
          }
        : {
            en: `Your body burns about ${roundedBmr} kcal a day just to exist — breathing, organs, brain.`,
            ar: `جسمك يحرق حوالي ${roundedBmr} سعرة في اليوم لمجرّد أن يعيش — التنفّس والأعضاء والدماغ.`,
          },
      tdee: {
        en: `Add how your day actually goes and you burn around ${tdee} kcal — that's your starting maintenance number. We correct it from your real weight and intake.`,
        ar: `أضف كيف يمرّ يومك فتحرق حوالي ${tdee} سعرة — هذا رقم ثباتك في البداية. ونصحّحه من وزنك ومن طعامك الحقيقي.`,
      },
      target: {
        en:
          delta === 0
            ? `${strategy.label.en}: you eat what you burn — ${calories} kcal a day.`
            : delta < 0
              ? `${strategy.label.en}: we cut ${Math.abs(delta)} kcal from your maintenance — that's ${calories} kcal a day.`
              : `${strategy.label.en}: we add ${delta} kcal to your maintenance — that's ${calories} kcal a day.`,
        ar:
          delta === 0
            ? `${strategy.label.ar}: تأكل بقدر ما تحرق — ${calories} سعرة في اليوم.`
            : delta < 0
              ? `${strategy.label.ar}: ننقص ${Math.abs(delta)} سعرة من ثباتك — أي ${calories} سعرة في اليوم.`
              : `${strategy.label.ar}: نضيف ${delta} سعرة إلى ثباتك — أي ${calories} سعرة في اليوم.`,
      },
      protein: {
        en: `${proteinG}g of protein keeps your muscle while you ${input.goal === "lose_fat" ? "lose fat" : "build"}.`,
        ar: `${proteinG}غ بروتين تحافظ على عضلك وأنت ${input.goal === "lose_fat" ? "تنقص الدهون" : "تبني"}.`,
      },
      fat: {
        en: `${fatG}g of fat keeps your hormones and energy steady.`,
        ar: `${fatG}غ دهون تُبقي هرموناتك وطاقتك ثابتة.`,
      },
      carbs: {
        en: `${carbsG}g of carbs fuel your training and your brain.`,
        ar: `${carbsG}غ كربوهيدرات تعطيك طاقة للتمرين وللدماغ.`,
      },
    },
  };
}
