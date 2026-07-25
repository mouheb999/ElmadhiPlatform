import { differenceInYears } from "date-fns";
import {
  resolveGoalStrategy,
  type BodyFatLevel,
  type Bilingual,
  type Goal,
} from "./diet-strategy";

/** kcal per gram. */
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Q8 daily-steps band → small additive kcal on top of the activity factor. */
export type DailySteps = "under_4k" | "4k_7k" | "7k_10k" | "over_10k" | "unknown";

const STEP_BONUS_KCAL: Record<DailySteps, number> = {
  under_4k: 0,
  "4k_7k": 100,
  "7k_10k": 200,
  over_10k: 350,
  unknown: 0,
};

export type MacroProfileInput = {
  gender: "male" | "female";
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  bodyFatLevel: BodyFatLevel;
  dailySteps: DailySteps;
};

export type MacroTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
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
  const h = input.heightCm;

  // Mifflin-St Jeor.
  const bmr =
    input.gender === "male"
      ? 10 * w + 6.25 * h - 5 * age + 5
      : 10 * w + 6.25 * h - 5 * age - 161;

  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel] + STEP_BONUS_KCAL[input.dailySteps]);

  const strategy = resolveGoalStrategy(input.goal, input.bodyFatLevel);

  // 1. Calories.
  const calories = Math.max(1200, Math.round(tdee * (1 + strategy.calorieFactor)));

  // 2. Protein (g/kg bodyweight).
  const proteinG = Math.round(w * strategy.proteinPerKg);

  // 3. Fat (% of calories, floor 0.5 g/kg).
  const fatFromPct = (calories * strategy.fatCaloriePct) / KCAL_PER_G_FAT;
  const fatFloor = 0.5 * w;
  const fatG = Math.round(Math.max(fatFromPct, fatFloor));

  // 4. Carbs = remainder.
  const carbsG = Math.max(
    0,
    Math.round((calories - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT) / KCAL_PER_G_CARBS),
  );

  // 5. Fiber from final calories.
  const fiberG = Math.round((calories / 1000) * 14);

  const delta = calories - tdee;

  return {
    bmr: Math.round(bmr),
    tdee,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    goalLabel: strategy.label,
    rationale: {
      bmr: {
        en: `Your body burns about ${Math.round(bmr)} kcal a day just to exist — breathing, organs, brain.`,
        ar: `جسمك يحرق حوالي ${Math.round(bmr)} سعرة في اليوم غير باش يعيش — التنفس، الأعضاء، الدماغ.`,
      },
      tdee: {
        en: `Add your daily activity and you burn around ${tdee} kcal per day — that's your maintenance number.`,
        ar: `زيد عليها نشاطك اليومي وتحرق حوالي ${tdee} سعرة في اليوم — هذا رقم الثبات متاعك.`,
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
