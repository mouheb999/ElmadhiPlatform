/**
 * Goal-based calorie/macro strategy — HYPE FITNESS simplified calculator.
 *
 * REWRITTEN to the "calculateur calories simplifié" sheet. What changed and why:
 *
 *   Calories   were a body-fat-interpolated band, then four flat multipliers of
 *              TDEE (×1.07 / ×0.85 / ×1.00). They have since moved out of this
 *              file entirely: see energy.ts, which derives them from an intended
 *              weekly rate of change so that the rate shown to the user and the
 *              calories shown to the user are the same decision.
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

const GOALS: Goal[] = ["lose_fat", "maintain", "build_muscle", "recomp"];

/**
 * A goal we will act on, whatever arrived.
 *
 * The switch below is exhaustive over `Goal`, which makes TypeScript happy and
 * did nothing for a value that reached it at runtime from a cookie, a stale
 * database row or an unanswered question — it fell through every case and
 * returned undefined, and the first property read off it threw. Maintenance is
 * the safe fallback: it prescribes no deficit and no surplus to somebody whose
 * goal we do not actually know.
 */
export function normalizeGoal(goal: unknown): Goal {
  return GOALS.includes(goal as Goal) ? (goal as Goal) : "maintain";
}

export type Bilingual = { en: string; ar: string };

export type GoalStrategy = {
  goal: Goal;
  /** Grams of protein per kg bodyweight. */
  proteinPerKg: number;
  label: Bilingual;
  rationale: Bilingual;
};

/**
 * Fat and carbohydrate bounds used to live here as loose constants. They are in
 * `macro-allocation.ts` now, inside POLICY, together with protein's — one place
 * where every bound in the system is stated with the reason it exists, so a
 * solver cannot quietly disagree with a copy of a number it no longer owns.
 */

/**
 * Protein and the wording for a goal. The calorie budget is NOT here.
 *
 * It used to be: a flat `calorieFactor` per goal, ×0.85 to cut and ×1.00 for
 * recomp and maintain. That flat factor is what broke the result page — ×1.00
 * rounds to within a few kcal of maintenance, so the weekly rate inferred from
 * it came out at −0.001 kg and the reveal printed a flat twelve-week line with
 * "0.0 kg/week" on it. Calories are now derived from an intended rate of change
 * in `energy.ts`, and the rate is read back off the result, so the two cannot
 * disagree. Protein per kg and the labels stayed here because neither depends
 * on the size of the budget.
 */
export function resolveGoalStrategy(input: Goal): GoalStrategy {
  const goal = normalizeGoal(input);
  switch (goal) {
    case "lose_fat":
      return {
        goal,
        proteinPerKg: 2.0,
        label: { en: "Fat loss", ar: "إنقاص الدهون" },
        rationale: {
          en: "A calorie deficit with high protein, so you lose fat while holding onto muscle.",
          ar: "عجز في السعرات مع بروتين عالٍ، لتنقص الدهون وتحافظ على العضل.",
        },
      };
    case "build_muscle":
      return {
        goal,
        proteinPerKg: 2.0,
        label: { en: "Lean muscle gain", ar: "زيادة عضلية نظيفة" },
        rationale: {
          en: "A small, controlled surplus — enough to build muscle, small enough that most of what you gain is muscle.",
          ar: "فائض صغير ومحسوب — يكفي لبناء العضل، وصغير بما يجعل أغلب ما تزيده عضلاً.",
        },
      };
    case "maintain":
      return {
        goal,
        proteinPerKg: 1.6,
        label: { en: "Health and maintenance", ar: "صحة وثبات" },
        rationale: {
          en: "You eat at maintenance — no deficit or surplus — with a balanced split of protein, carbs and fat.",
          ar: "تأكل بقدر ما تحرق — بلا عجز ولا فائض — بتوزيع متوازن بين البروتين والكربوهيدرات والدهون.",
        },
      };
    case "recomp":
      return {
        goal,
        proteinPerKg: 2.0,
        label: { en: "Body recomposition", ar: "إعادة تشكيل الجسم" },
        rationale: {
          en: "Calories sit just under maintenance with high protein, so you can lose fat and build muscle at the same time.",
          ar: "السعرات تبقى أقلّ قليلاً من الثبات مع بروتين عالٍ، لتنقص الدهون وتبني العضل في الوقت نفسه.",
        },
      };
  }
}
