/**
 * BMR → TDEE → calorie target → weekly rate. One place, for the whole product.
 *
 * ## Why this file exists
 *
 * The calorie target and the weight projection used to be computed by two
 * different pieces of code that never compared notes. `diet-strategy.ts` set
 * calories as a flat multiple of TDEE (×0.85 to cut, ×1.07 to gain, ×1.00 for
 * recomp and maintain); `funnel/projection.ts` then read those calories back
 * and inferred a weekly rate from them. That inference is where the result page
 * broke: a recomp target of ×1.00 rounds to within a few kcal of maintenance,
 * the inferred rate came out at −0.001 kg/week, and the reveal printed "0.0
 * kg/week" over a flat twelve-week line.
 *
 * The fix is not a patch on the rate. It is to make the rate and the calories
 * the *same* decision, taken once:
 *
 *     inputs → BMR → TDEE → intended rate → energy balance → calories
 *                                              ↑                  │
 *                                              └── re-derived ────┘
 *
 * The intended rate sets the deficit, the deficit sets the calories, and then
 * the reported rate is re-derived from the calories that actually survived the
 * safety clamps. Those two numbers therefore cannot disagree — whatever the
 * floors do to the calorie target, the rate on screen is the rate that target
 * implies. Everything downstream (macros, the reveal, the timeline, the paid
 * plan) reads this one result.
 *
 * ## What feeds it
 *
 * Sex, age, height, weight, daily activity, training frequency, goal, and pace
 * where it is known. No new questions were added: `trainingDays` is already
 * collected by both the funnel and the paid questionnaire and was simply never
 * read by the calculator.
 *
 * ## What it is not
 *
 * An estimate, not a prescription. Every number here is a defensible starting
 * point that `diet-adaptation.ts` corrects from real weigh-ins and real intake.
 * Nothing in this file promises an outcome.
 */

import { restingEnergy, type ActivityLevel } from "./macros-core";
import { normalizeGoal, type Goal } from "./diet-strategy";

/** Energy in a kilo of body mass. The standard figure, near enough. */
export const KCAL_PER_KG = 7700;

/**
 * The lowest daily total we will ever prescribe, whatever the arithmetic says.
 * Below this it is not a diet, it is a problem.
 */
export const CALORIE_FLOOR = 1200;

/**
 * The absolute daily minimums, by sex. The conventional clinical floors, and
 * the only hard floor this file applies.
 *
 * An earlier draft floored the target at BMR × 1.05 instead, on the reasoning
 * that nobody should eat below their resting rate. That reads well and behaves
 * badly: BMR scales with mass, so the heavier the person the higher the floor,
 * and the people with the most to lose got the smallest deficit. A 160 kg man
 * came out at 0.25% of bodyweight a week — a quarter of what is both safe and
 * expected for him — purely because his resting rate is large. The deficit is
 * bounded as a share of TDEE instead (see MAX_DEFICIT_FACTOR), which scales the
 * right way, and these floors catch the small-and-sedentary corner where a
 * percentage still lands somewhere silly.
 */
const ABSOLUTE_FLOOR: Record<"male" | "female", number> = {
  male: 1500,
  female: 1200,
};

/**
 * Daily activity — how the day goes, NOT how they train.
 *
 * Training is added separately below, because folding it in here and then
 * adding a training bonus on top counts the same gym session twice. That
 * separation is why these can be the textbook occupational factors without
 * inflating anybody's number.
 */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // sits almost all day
  light: 1.375, // mix of sitting and standing
  moderate: 1.55, // on their feet, walks a lot
  active: 1.65, // physical job
  very_active: 1.725, // very physical job
};

/**
 * What training adds, per the frequency band already on the questionnaire.
 *
 * A resistance session is worth roughly 250–350 kcal to someone of ordinary
 * size, so six a week is about +10% of a day's expenditure. That is the ceiling
 * here, and it is deliberately the low end of what the literature would allow:
 * an overestimated TDEE produces a deficit that does not exist, and the first
 * month of no progress is what makes somebody stop believing the plan.
 *
 * This doubles as the consistency check on a contradictory pair of answers.
 * Somebody who reports a desk job and six sessions a week is not sedentary, and
 * the bump moves them off the bottom factor without a special case.
 */
const TRAINING_BUMP: Record<string, number> = {
  "0": 0,
  "1_2": 0.025,
  "3_4": 0.05,
  "5_6": 0.075,
  "7": 0.1,
};

/** The band the combined factor is held inside, whatever the two answers say. */
const MIN_FACTOR = 1.2;
const MAX_FACTOR = 1.85;

/**
 * How fast fat loss is aimed at, as a fraction of bodyweight per week.
 *
 * The product is positioned on visible progress, so this picks the faster end
 * of the defensible range — but it scales with how much there is to lose. The
 * same 0.75%/week that is comfortable at a BMI of 32 is, at a BMI of 21, a
 * deficit taken mostly out of muscle. Leaner bodies get the gentler number, and
 * they get it automatically rather than by asking one more question.
 */
function lossFractionForBmi(bmi: number): number {
  if (bmi >= 30) return 0.0075;
  if (bmi >= 27) return 0.007;
  if (bmi >= 25) return 0.0065;
  if (bmi >= 22) return 0.0055;
  return 0.005;
}

/**
 * Where a lean bulk is aimed. 0.3% of bodyweight a week is about 0.22 kg for a
 * 75 kg lifter — fast enough to be a surplus, slow enough that most of it can
 * be muscle. Faster gaining is mostly not.
 */
const GAIN_FRACTION = 0.003;

/** And the surplus is kept inside the conventional band regardless. */
const MIN_SURPLUS_FACTOR = 0.05;
const MAX_SURPLUS_FACTOR = 0.1;

/** Recomposition: maintenance, minus a modest nudge. */
const RECOMP_FACTOR = 0.95;

/** A deficit deeper than this stops being a diet somebody finishes. */
const MAX_DEFICIT_FACTOR = 0.25;

/**
 * Pace, if it is ever asked for. Nothing collects it today, so it is optional
 * and absent means `standard`; the shape is here so adding one question later
 * does not mean re-opening this arithmetic.
 */
export type Pace = "steady" | "standard" | "fast";

const PACE_SCALE: Record<Pace, number> = {
  steady: 0.8,
  standard: 1,
  fast: 1.15,
};

/**
 * Why a plan was softened, when it was.
 *
 * Not a diagnosis and not a refusal to help — it switches the target to
 * maintenance and tells the screen to say why, rather than handing an
 * aggressive deficit to somebody who should be talking to a person first.
 */
export type GuidanceFlag = "minor" | "underweight";

/** Under this age, no calculator should be writing a deficit. */
const MINOR_AGE = 16;

/** And under this BMI, nobody should be cutting. */
const UNDERWEIGHT_BMI = 18.5;

export type EnergyInput = {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** "0" | "1_2" | "3_4" | "5_6" | "7". Absent means no training bump. */
  trainingDays?: string | null;
  bodyFatPercent?: number | null;
  pace?: Pace | null;
};

export type EnergyPlan = {
  bmr: number;
  tdee: number;
  calories: number;
  /** `calories - tdee`. Negative is a deficit. */
  energyBalanceKcal: number;
  /** What that balance is worth on the scale each week. Signed. */
  weeklyRateKg: number;
  /** The same rate as a fraction of bodyweight, always positive. */
  weeklyRateFraction: number;
  direction: "down" | "up" | "hold";
  /** BMR × this = TDEE. Exposed so the reveal can explain the number. */
  activityFactor: number;
  usedLeanMass: boolean;
  /** Set when the target was softened for safety. See GuidanceFlag. */
  guidance: GuidanceFlag | null;
};

/** Clamp that also refuses NaN/Infinity, so nothing downstream can see one. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** The weight at which this person's BMI is 18.5 — the floor any curve stops at. */
export function healthyFloorKg(heightCm: number): number {
  const m = heightCm / 100;
  return UNDERWEIGHT_BMI * m * m;
}

/**
 * The weight protein and fat are prescribed against.
 *
 * Both are grams per kilo, and at a high BMI "per kilo of what you weigh" stops
 * making sense: fat mass has no protein requirement. A 100 kg woman at 160 cm
 * was being given 200 g of protein and 70 g of fat — 1,430 kcal — against a
 * 1,430 kcal budget, which leaves exactly nothing for carbohydrate. The old
 * flat ×0.85 deficit hid this by a hair (47 g of carbs); a deficit sized to her
 * actual body does not.
 *
 * So above a BMI of 27.5 the grams-per-kilo rules are applied to the weight she
 * would be AT 27.5 instead. Nobody at or below that reference is affected —
 * `min` makes this the identity for the ordinary case — and nobody above it is
 * handed a macro split that cannot fit inside their own calorie target.
 */
const REFERENCE_BMI = 27.5;

export function referenceWeightKg(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.min(weightKg, REFERENCE_BMI * m * m);
}

export function bmiOf(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}

/**
 * The combined multiplier: how they live, plus how they train.
 *
 * Exported because the projection re-runs it every simulated week — the factor
 * is a property of the person's habits and does not change as they lose weight,
 * so recomputing it from scratch each week would be both wasteful and a chance
 * for the two to drift apart.
 */
export function activityFactorFor(
  activityLevel: ActivityLevel,
  trainingDays?: string | null,
): number {
  const base = ACTIVITY_FACTORS[activityLevel] ?? ACTIVITY_FACTORS.light;
  const bump = (trainingDays && TRAINING_BUMP[trainingDays]) || 0;
  return clampNumber(base + bump, MIN_FACTOR, MAX_FACTOR, ACTIVITY_FACTORS.light);
}

/**
 * The whole decision, in one pass.
 *
 * Read the order carefully: calories are settled — including every clamp — and
 * only then is the weekly rate read back off them. That is the invariant this
 * file exists to hold, and it is what makes "2,220 kcal" and "0.47 kg/week" two
 * views of one number instead of two numbers that happen to be on one screen.
 */
export function resolveEnergyPlan(input: EnergyInput): EnergyPlan {
  // Nothing past this point can receive a NaN, a zero or a negative.
  const age = clampNumber(input.age, 10, 100, 30);
  const heightCm = clampNumber(input.heightCm, 120, 230, 170);
  const weightKg = clampNumber(input.weightKg, 30, 300, 70);
  const gender = input.gender === "female" ? "female" : "male";
  const goal = normalizeGoal(input.goal);

  const { value: rawBmr, usedLeanMass } = restingEnergy({
    gender,
    age,
    heightCm,
    weightKg,
    bodyFatPercent: input.bodyFatPercent,
  });
  // Mifflin can go non-positive for absurd combinations the clamps above do not
  // quite exclude. A resting rate is never below this.
  const bmr = Math.max(800, Math.round(rawBmr));

  const activityFactor = activityFactorFor(input.activityLevel, input.trainingDays);
  const tdee = Math.round(bmr * activityFactor);

  const bmi = bmiOf(weightKg, heightCm);

  // Screening, before any deficit is computed. A minor or an underweight body
  // asking to cut gets maintenance and a pointer to a person, not a softer
  // deficit — a smaller wrong answer is still the wrong answer.
  let guidance: GuidanceFlag | null = null;
  if (age < MINOR_AGE) guidance = "minor";
  else if (bmi < UNDERWEIGHT_BMI) guidance = "underweight";

  const wantsCut = goal === "lose_fat" || goal === "recomp";
  const screened = guidance !== null && wantsCut;

  // Maintenance is the one target that must land on TDEE exactly, and it is
  // worth a branch of its own. Rounding it to the nearest ten leaves a residual
  // imbalance of a few kcal, which the rate below faithfully reports as
  // −0.004 kg/week — a phantom trend, printed as "0.0 kg/week", which is the
  // exact class of artefact this rewrite exists to remove. A plan that intends
  // no energy balance is given no energy balance.
  const holdAtMaintenance = screened || goal === "maintain";

  let calories: number;
  if (holdAtMaintenance) {
    calories = tdee;
  } else if (goal === "lose_fat") {
    const pace = PACE_SCALE[input.pace ?? "standard"] ?? 1;
    const fraction = lossFractionForBmi(bmi) * pace;
    const deficit = Math.min(
      (fraction * weightKg * KCAL_PER_KG) / 7,
      tdee * MAX_DEFICIT_FACTOR,
    );
    calories = tdee - deficit;
  } else if (goal === "build_muscle") {
    const wanted = (GAIN_FRACTION * weightKg * KCAL_PER_KG) / 7;
    const surplus = clampNumber(
      wanted,
      tdee * MIN_SURPLUS_FACTOR,
      tdee * MAX_SURPLUS_FACTOR,
      tdee * MIN_SURPLUS_FACTOR,
    );
    calories = tdee + surplus;
  } else {
    calories = tdee * RECOMP_FACTOR;
  }

  // The floor, then a round to the nearest ten so the number reads like a
  // target rather than a readout. Maintenance skips the rounding, per above.
  const floor = Math.max(CALORIE_FLOOR, ABSOLUTE_FLOOR[gender]);
  calories = Math.max(floor, calories);
  if (!holdAtMaintenance) calories = Math.round(calories / 10) * 10;
  calories = Math.round(calories);

  // Re-derived, never assumed. If the floor above lifted the target, the rate
  // below is the smaller rate that lift implies — which is the honest number,
  // and the one the projection will walk.
  const energyBalanceKcal = calories - tdee;
  const weeklyRateKg = (energyBalanceKcal * 7) / KCAL_PER_KG;

  return {
    bmr,
    tdee,
    calories,
    energyBalanceKcal,
    weeklyRateKg,
    weeklyRateFraction: weightKg > 0 ? Math.abs(weeklyRateKg) / weightKg : 0,
    direction: weeklyRateKg < -0.01 ? "down" : weeklyRateKg > 0.01 ? "up" : "hold",
    activityFactor,
    usedLeanMass,
    guidance,
  };
}
