/**
 * Goal-based calorie/macro strategy — from the HYPE FITNESS nutrition formula sheet.
 *
 * There is no user-facing "intensity" switch anymore. Each goal defines a RANGE
 * for the calorie adjustment, protein g/kg, and fat % of calories; the exact
 * value inside each range is chosen from the user's self-reported body-fat
 * level (higher body fat → deeper cut, more protein per kg). This replaces the
 * old fixed-delta intensity table (cut_normal/aggressive, bulk_clean/dirty).
 *
 * Formula order, applied by macros.ts: calories → protein → fat → carbs
 * (remainder) → fiber.
 */

export type Goal = "lose_fat" | "maintain" | "build_muscle" | "recomp";

/** Q7 body-fat estimate. Drives where inside each range we land. */
export type BodyFatLevel = "very_lean" | "normal" | "a_little_fat" | "high" | "unknown";

export type Bilingual = { en: string; ar: string };

/** 0 = very lean … 1 = high body fat. "unknown" sits at the middle. */
export function bodyFatScalar(level: BodyFatLevel): number {
  switch (level) {
    case "very_lean":
      return 0;
    case "normal":
      return 0.5;
    case "a_little_fat":
      return 0.75;
    case "high":
      return 1;
    case "unknown":
      return 0.5;
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export type GoalStrategy = {
  goal: Goal;
  /** Fraction of TDEE to add (negative = deficit). e.g. -0.20 = TDEE −20%. */
  calorieFactor: number;
  /** Grams of protein per kg bodyweight. */
  proteinPerKg: number;
  /** Fat as a fraction of total calories. */
  fatCaloriePct: number;
  label: Bilingual;
  rationale: Bilingual;
};

/**
 * Resolve the concrete numbers for a goal, given body fat. Ranges are taken
 * verbatim from the formula sheet:
 *
 *   Cut       cals −15…−25%   protein 1.8–2.4   fat 20–25%
 *   Lean bulk cals +10…+15%   protein 1.6–2.0   fat 25–30%
 *   Maintain  cals ±0%        protein 1.4–1.8   fat 25–35%
 *   Recomp    cals −0…−10%    protein 1.8–2.2   fat 25–30%
 */
export function resolveGoalStrategy(goal: Goal, bodyFat: BodyFatLevel): GoalStrategy {
  const f = bodyFatScalar(bodyFat);

  switch (goal) {
    case "lose_fat":
      return {
        goal,
        calorieFactor: -lerp(0.15, 0.25, f), // higher body fat → deeper cut
        proteinPerKg: lerp(1.8, 2.4, f),
        fatCaloriePct: 0.225,
        label: { en: "Fat loss", ar: "تنشيف" },
        rationale: {
          en: "A calorie deficit with high protein and lower carbs, so you lose fat while holding onto muscle.",
          ar: "نقص في السعرات مع بروتين عالي وكربوهيدرات أقل، باش تنشّف وتحافظ على العضل.",
        },
      };
    case "build_muscle":
      return {
        goal,
        calorieFactor: lerp(0.15, 0.1, f), // leaner → bigger surplus
        proteinPerKg: lerp(2.0, 1.6, f),
        fatCaloriePct: 0.275,
        label: { en: "Lean muscle gain", ar: "تضخيم نظيف" },
        rationale: {
          en: "A small, controlled surplus with higher carbs to fuel training and build muscle with minimal fat gain.",
          ar: "فائض صغير ومحسوب مع كربوهيدرات أعلى باش تعطي طاقة للتمرين وتبني عضل بأقل دهون.",
        },
      };
    case "maintain":
      return {
        goal,
        calorieFactor: 0,
        proteinPerKg: lerp(1.4, 1.8, f),
        fatCaloriePct: 0.275,
        label: { en: "Maintain weight", ar: "ثبات الوزن" },
        rationale: {
          en: "You eat at maintenance — no deficit or surplus — with a balanced split of protein, carbs and fat.",
          ar: "تاكل قد ما تحرق — بلا نقص ولا زيادة — بتوزيع متوازن بين البروتين والكربوهيدرات والدهون.",
        },
      };
    case "recomp":
      return {
        goal,
        calorieFactor: -lerp(0, 0.1, f), // leaner → closer to maintenance
        proteinPerKg: lerp(1.8, 2.2, f),
        fatCaloriePct: 0.275,
        label: { en: "Body recomposition", ar: "إعادة تشكيل الجسم" },
        rationale: {
          en: "Calories stay close to maintenance with high protein, so you can lose fat and build muscle at the same time.",
          ar: "السعرات تبقى قريبة من الثبات مع بروتين عالي، باش تنشّف وتبني عضل في نفس الوقت.",
        },
      };
  }
}
