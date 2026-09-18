import { differenceInYears } from "date-fns";
import {
  resolveGoalStrategy,
  FAT_PER_KG,
  FAT_PER_KG_FLOOR,
  type Bilingual,
  type Goal,
} from "./diet-strategy";
import {
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  isUsableBodyFatPercent,
  restingEnergy,
  type ActivityLevel,
} from "./macros-core";
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

/**
 * The least carbohydrate a training plan should be built on. Reached only in
 * the corner where a heavy, short, older person on a cut has their whole
 * calorie budget consumed by protein and fat; see `solveFatAndCarbs`.
 */
const MIN_CARBS_G = 50;

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

/**
 * The most protein this calorie budget can actually hold.
 *
 * `solveFatAndCarbs` below gives fat 0.2 g/kg of give before carbohydrate is
 * allowed to fall to the floor. Protein had none: it was prescribed at a flat
 * g/kg and everything else had to fit around it. In the corner where protein at
 * 2.0 g/kg plus fat at its 0.7 g/kg floor already exceeds the target — a very
 * tall, very heavy person on a deep cut — carbohydrate was clamped to zero and
 * the three macros then summed to MORE than the calories they were shown
 * beside. One combination in 99,840 swept, but it is a plan with no
 * carbohydrate in it and a total that does not match its own header.
 *
 * So protein yields too, after fat and after the carbohydrate minimum, and not
 * below 1.2 g/kg — still comfortably above what muscle retention on a cut
 * needs. For every ordinary body this ceiling sits far above the prescription
 * and nothing changes.
 */
function proteinCeilingG(calories: number, refKg: number): number {
  const reserved = MIN_CARBS_G * KCAL_PER_G_CARBS + FAT_PER_KG_FLOOR * refKg * KCAL_PER_G_FAT;
  const affordable = (calories - reserved) / KCAL_PER_G_PROTEIN;
  // The ceiling never drops below 1.2 g/kg: if a budget cannot even hold that,
  // the calorie floor is what is binding and protein is not the thing to cut.
  return Math.max(affordable, 1.2 * refKg);
}

/**
 * Fat and carbs, given the calorie budget protein has already been taken out of.
 *
 * Fat is prescribed as an absolute 0.9 g/kg rather than as a share of calories.
 * On a deep cut for a heavy person that can leave almost nothing for carbs:
 * 200 g protein and 90 g fat is 1610 kcal of a 1620 kcal budget. This is what
 * the sheet's `fat >= poids × 0.7` minimum is for — fat has 0.2 g/kg of give in
 * it, and we spend that give here before letting carbs fall to nothing.
 */
function solveFatAndCarbs(
  calories: number,
  proteinG: number,
  weightKg: number,
): { fatG: number; carbsG: number } {
  const afterProtein = calories - proteinG * KCAL_PER_G_PROTEIN;

  let fatG = FAT_PER_KG * weightKg;
  let carbsKcal = afterProtein - fatG * KCAL_PER_G_FAT;

  if (carbsKcal < MIN_CARBS_G * KCAL_PER_G_CARBS) {
    const wanted = (afterProtein - MIN_CARBS_G * KCAL_PER_G_CARBS) / KCAL_PER_G_FAT;
    fatG = Math.max(FAT_PER_KG_FLOOR * weightKg, wanted);
    carbsKcal = afterProtein - fatG * KCAL_PER_G_FAT;
  }

  return {
    fatG: Math.round(fatG),
    // Rounded from the same fat figure the caller is shown, so the three macros
    // the user reads back add up to the calories they are given.
    carbsG: Math.max(0, Math.round((afterProtein - Math.round(fatG) * KCAL_PER_G_FAT) / KCAL_PER_G_CARBS)),
  };
}

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

  // 7-9. Protein, fat, then carbs from what is left — all three per kilo of the
  // reference weight rather than the scale weight, which only differs above a
  // BMI of 27.5. See referenceWeightKg: fat mass has no protein requirement,
  // and prescribing as though it did can consume a whole calorie budget before
  // carbohydrate gets any of it.
  const refKg = referenceWeightKg(w, input.heightCm);
  const proteinG = Math.round(
    Math.min(refKg * strategy.proteinPerKg, proteinCeilingG(calories, refKg)),
  );
  const { fatG, carbsG } = solveFatAndCarbs(calories, proteinG, refKg);

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
