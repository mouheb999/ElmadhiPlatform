/**
 * Goal-based calorie/macro strategy — HYPE FITNESS simplified calculator.
 *
 * REWRITTEN to the "calculateur calories simplifié" sheet. What changed and why:
 *
 *   Calories   were a body-fat-interpolated band (cut −15…−25 %, bulk +10…+15 %,
 *              recomp −0…−10 %). They are now four flat multipliers of TDEE:
 *              ×1.07 gain, ×0.85 loss, ×1.00 recomp and maintain.
 *   Protein    was 1.4–2.4 g/kg interpolated the same way. It is now 2.0 g/kg
 *              for every goal that is trying to change body composition, and
 *              1.6 g/kg for plain health maintenance.
 *   Fat        was a percentage of calories (20–27.5 %) with a 0.5 g/kg floor.
 *              It is now an absolute 0.9 g/kg with a 0.7 g/kg floor — see
 *              macros.ts, which spends that headroom when carbs would otherwise
 *              collapse.
 *   Body fat   no longer moves any of these numbers, and the self-reported
 *              CATEGORY is no longer asked for at all. The sheet is explicit:
 *              a self-reported body type "peut rester dans le quiz pour
 *              l'expérience utilisateur, mais il ne doit pas être utilisé comme
 *              donnée principale pour calculer les calories." What a measured
 *              body-fat PERCENTAGE does change is the metabolic rate itself
 *              (RMR from lean mass), and that lives in macros.ts.
 *
 * The premise behind the simplification: no formula knows anybody's real
 * requirement on day one. The quiz produces a defensible starting number and
 * the weight/intake calibration in diet-adaptation.ts is what personalises it.
 * Interpolating a starting estimate against a guessed body-fat category was
 * precision the input never had.
 *
 * Formula order, applied by macros.ts: calories → protein → fat → carbs
 * (remainder) → fiber.
 */

export type Goal = "lose_fat" | "maintain" | "build_muscle" | "recomp";

export type Bilingual = { en: string; ar: string };

export type GoalStrategy = {
  goal: Goal;
  /** Multiplier applied to TDEE. 1.07 = TDEE +7 %. */
  calorieFactor: number;
  /** Grams of protein per kg bodyweight. */
  proteinPerKg: number;
  label: Bilingual;
  rationale: Bilingual;
};

/** Grams of fat per kg bodyweight, and the floor it may be cut to. */
export const FAT_PER_KG = 0.9;
export const FAT_PER_KG_FLOOR = 0.7;

/** Resolve the concrete numbers for a goal. Flat, per the sheet. */
export function resolveGoalStrategy(goal: Goal): GoalStrategy {
  switch (goal) {
    case "lose_fat":
      return {
        goal,
        calorieFactor: 0.85,
        proteinPerKg: 2.0,
        label: { en: "Fat loss", ar: "تنشيف" },
        rationale: {
          en: "A calorie deficit with high protein, so you lose fat while holding onto muscle.",
          ar: "نقص في السعرات مع بروتين عالي، باش تنشّف وتحافظ على العضل.",
        },
      };
    case "build_muscle":
      return {
        goal,
        calorieFactor: 1.07,
        proteinPerKg: 2.0,
        label: { en: "Lean muscle gain", ar: "تضخيم نظيف" },
        rationale: {
          en: "A small, controlled surplus — enough to build muscle, small enough that most of what you gain is muscle.",
          ar: "فائض صغير ومحسوب — يكفي باش تبني عضل، وصغير باش أغلب ما تزيدو يكون عضل.",
        },
      };
    case "maintain":
      return {
        goal,
        calorieFactor: 1.0,
        proteinPerKg: 1.6,
        label: { en: "Health and maintenance", ar: "صحة وثبات" },
        rationale: {
          en: "You eat at maintenance — no deficit or surplus — with a balanced split of protein, carbs and fat.",
          ar: "تاكل قد ما تحرق — بلا نقص ولا زيادة — بتوزيع متوازن بين البروتين والكربوهيدرات والدهون.",
        },
      };
    case "recomp":
      return {
        goal,
        calorieFactor: 1.0,
        proteinPerKg: 2.0,
        label: { en: "Body recomposition", ar: "إعادة تشكيل الجسم" },
        rationale: {
          en: "Calories stay at maintenance with high protein, so you can lose fat and build muscle at the same time.",
          ar: "السعرات تبقى في الثبات مع بروتين عالي، باش تنشّف وتبني عضل في نفس الوقت.",
        },
      };
  }
}
