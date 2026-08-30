import { differenceInYears } from "date-fns";
import {
  resolveGoalStrategy,
  FAT_PER_KG,
  FAT_PER_KG_FLOOR,
  type Bilingual,
  type Goal,
} from "./diet-strategy";

/** kcal per gram. */
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

/**
 * Q6 — how the user's DAY looks, not how they train.
 *
 * These used to be the textbook Harris-Benedict exercise multipliers
 * (1.2 / 1.375 / 1.55 / 1.725 / 1.9), which fold training frequency into the
 * activity factor and then get a separate step bonus on top. The simplified
 * calculator narrows them to occupational activity alone — 1.20 to 1.60 — and
 * deliberately leaves training, cardio and step count OUT of the estimate.
 *
 * That is not an oversight in the sheet; it is the point. "Sans nombre de pas,
 * fréquence exacte d'entraînement et cardio, ce TDEE est volontairement une
 * estimation simple." A narrower, honest starting range calibrates faster than
 * a wide one built out of three guesses stacked on each other.
 *
 * The five keys are unchanged so every stored `diet_profiles.activity_level`
 * still reads back; only what they mean and what they are worth changed.
 */
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // sits almost all day
  light: 1.3, // mix of sitting and standing
  moderate: 1.4, // on their feet, walks a lot
  active: 1.5, // physical job
  very_active: 1.6, // very physical job
};

/**
 * The lowest daily total we will ever prescribe. The sheet has no floor — it
 * assumes an adult of ordinary size — but ×0.85 of a small, sedentary person's
 * TDEE lands under 1200 kcal, which is not a plan, it is a problem.
 */
export const CALORIE_FLOOR = 1200;

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

/** A body-fat percentage we will actually believe. Anything else is ignored. */
export function isUsableBodyFatPercent(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 3 && value <= 60;
}

/**
 * Resting energy expenditure.
 *
 * Mifflin-St Jeor uses height and age as stand-ins for how much lean tissue a
 * person is carrying. When the actual body-fat percentage is known those
 * stand-ins are not needed: lean mass is the thing that burns, so
 * `500 + 22 × LBM` reads it directly. Two people of the same height, age and
 * weight get the same Mifflin number and can have very different requirements;
 * this is the input that tells them apart.
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

  // 1-3. Resting energy — from lean mass when body fat is known, else Mifflin.
  const { value: bmr, usedLeanMass } = restingEnergy({
    gender: input.gender,
    age,
    heightCm: input.heightCm,
    weightKg: w,
    bodyFatPercent: input.bodyFatPercent,
  });

  // 4-5. Daily activity → TDEE.
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]);

  const strategy = resolveGoalStrategy(input.goal);

  // 6. Calories for the goal, rounded to the nearest ten as the sheet asks.
  const calories = Math.max(CALORIE_FLOOR, Math.round((tdee * strategy.calorieFactor) / 10) * 10);

  // 7. Protein.
  const proteinG = Math.round(w * strategy.proteinPerKg);

  // 8-9. Fat, then carbs from what is left.
  const { fatG, carbsG } = solveFatAndCarbs(calories, proteinG, w);

  // Fiber from final calories.
  const fiberG = Math.round((calories / 1000) * 14);

  const delta = calories - tdee;
  const roundedBmr = Math.round(bmr);

  return {
    bmr: roundedBmr,
    tdee,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    usedLeanMass,
    goalLabel: strategy.label,
    rationale: {
      bmr: usedLeanMass
        ? {
            en: `From your body fat, you carry about ${Math.round(w * (1 - (input.bodyFatPercent as number) / 100))} kg of lean mass — that burns around ${roundedBmr} kcal a day at rest.`,
            ar: `من نسبة الدهون متاعك، عندك حوالي ${Math.round(w * (1 - (input.bodyFatPercent as number) / 100))} كيلو كتلة صافية — تحرق حوالي ${roundedBmr} سعرة في اليوم وأنت مرتاح.`,
          }
        : {
            en: `Your body burns about ${roundedBmr} kcal a day just to exist — breathing, organs, brain.`,
            ar: `جسمك يحرق حوالي ${roundedBmr} سعرة في اليوم غير باش يعيش — التنفس، الأعضاء، الدماغ.`,
          },
      tdee: {
        en: `Add how your day actually goes and you burn around ${tdee} kcal — that's your starting maintenance number. We correct it from your real weight and intake.`,
        ar: `زيد كيفاش تمشي نهاريتك وتحرق حوالي ${tdee} سعرة — هذا رقم الثبات متاعك في البداية. نصححوه من وزنك ومن الماكلة الحقيقية متاعك.`,
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
            ? `${strategy.label.ar}: تاكل قد ما تحرق — ${calories} سعرة في اليوم.`
            : delta < 0
              ? `${strategy.label.ar}: ننقصو ${Math.abs(delta)} سعرة من الثبات متاعك — يعني ${calories} سعرة في اليوم.`
              : `${strategy.label.ar}: نزيدو ${delta} سعرة على الثبات متاعك — يعني ${calories} سعرة في اليوم.`,
      },
      protein: {
        en: `${proteinG}g of protein keeps your muscle while you ${input.goal === "lose_fat" ? "lose fat" : "build"}.`,
        ar: `${proteinG}غ بروتين يحافظ على عضلك وأنت ${input.goal === "lose_fat" ? "تنشف" : "تبني"}.`,
      },
      fat: {
        en: `${fatG}g of fat keeps your hormones and energy steady.`,
        ar: `${fatG}غ دهون تخلي الهرمونات والطاقة متاعك ثابتة.`,
      },
      carbs: {
        en: `${carbsG}g of carbs fuel your training and your brain.`,
        ar: `${carbsG}غ كربوهيدرات تعطيك طاقة للتمرين والدماغ.`,
      },
    },
  };
}
