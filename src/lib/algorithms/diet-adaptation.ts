/**
 * Weekly calorie calibration. Pure and deterministic: 14 days of weigh-ins,
 * 14 days of logged intake and the current targets in, a clamped proposal out.
 * The rules decide; i18n templates explain; no LLM anywhere.
 *
 * WHY THIS EXISTS AT ALL. No formula knows anybody's real requirement on day
 * one — the quiz produces a defensible estimate and nothing more. The sheet is
 * blunt about it: "Le quiz = estimation initiale. Le suivi réel =
 * personnalisation." This module is the personalisation half, and it is the
 * reason macros.ts was allowed to get simpler rather than more elaborate.
 *
 * TWO PATHS, and which one runs depends on what the user actually gave us.
 *
 *   CALIBRATE (the real one). With enough logged intake we can solve for
 *   maintenance directly, because weight change over a period IS the energy
 *   balance over that period:
 *
 *       observed_TDEE = avg_daily_calories − (weight_change_per_week × 7700) / 7
 *
 *   7700 kcal ≈ 1 kg of body tissue. Somebody eating 2400 kcal and holding
 *   steady maintains at 2400, whatever the quiz said. That number is noisy, so
 *   it is blended rather than adopted — 70 % of the old estimate, 30 % of the
 *   new one — and the whole move is capped at ±150 kcal per update. The new
 *   target is then the calibrated maintenance times the goal's own multiplier,
 *   which means the deficit or surplus stays correct by construction instead of
 *   being nudged toward correctness.
 *
 *   NUDGE (the fallback). Without reliable intake there is no observed_TDEE to
 *   compute, only a weight trend — so the target moves ±100 kcal/day in the
 *   direction the trend says it should, exactly as the sheet's section 7
 *   describes. This is the coarse tool, used only when the fine one has no
 *   input.
 *
 * They never both fire: calibration already puts the deficit where it belongs,
 * and adding a nudge on top would double-correct the same week's data.
 *
 * Guard-rails, in order of importance:
 *  - Never propose without enough data (≥2 weigh-ins in each half of the
 *    window) — one noisy weigh-in must not move a plan. Water, glycogen, salt
 *    and digestion all move the scale; only an average means anything.
 *  - Never adjust more than once per 7 days (cooldown checked by caller
 *    against plan_adaptations).
 *  - Never move calories more than 10 % at once, never below BMR (or the
 *    1200 kcal floor when BMR is unknown).
 *  - Protein is never touched: the delta comes from carbs (60 %) and fat
 *    (40 %), with floors so neither collapses.
 */

export type WeighIn = { date: string; weightKg: number };
/** One day's total intake, as logged. Days with no log are simply absent. */
export type IntakeDay = { date: string; calories: number };

export type CurrentTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  fiberG: number;
};

export type DietAdaptationReason =
  | "adapt.calibrated_up"
  | "adapt.calibrated_down"
  | "adapt.cut_stall"
  | "adapt.cut_too_fast"
  | "adapt.bulk_stall"
  | "adapt.bulk_too_fast";

export type DietProposal = {
  reasonKey: DietAdaptationReason;
  deltaKcal: number; // signed
  oldCalories: number;
  newCalories: number;
  newProteinG: number;
  newCarbsG: number;
  newFatG: number;
  trendKg: number; // avg(recent week) - avg(prior week)
  /** The maintenance estimate to store going forward. Unchanged on a nudge. */
  newTdee: number;
  /** What the logged intake said maintenance actually is. Null on a nudge. */
  observedTdee: number | null;
};

const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;
const MIN_CARBS_G = 50;
const MIN_FAT_G = 30;
const CALORIE_FLOOR = 1200;

/** kcal in a kilogram of body tissue — the constant that makes the maths work. */
const KCAL_PER_KG = 7700;

/** The most the maintenance estimate may move in one update. */
export const MAX_TDEE_CORRECTION = 150;

/** How much of the new observation to believe. The rest stays with the old estimate. */
const OBSERVED_WEIGHT = 0.3;

/**
 * Logged days needed before intake is trusted as an average. Below this the
 * user is logging some meals and not others, and the "average" is a floor, not
 * a measurement — calibrating on it would drive the target down every week.
 */
const MIN_LOGGED_DAYS = 8;

/** The goal multipliers from macros.ts, in the form this module needs. */
const GOAL_FACTOR: Record<string, number> = {
  lose_fat: 0.85,
  build_muscle: 1.07,
  recomp: 1,
  maintain: 1,
};

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function roundTo25(value: number): number {
  return Math.round(value / 25) * 25;
}

/**
 * Maintenance as the last two weeks actually measured it.
 *
 * Exported so it can be tested against hand-worked examples, and read on its
 * own by anything that wants the number without the proposal around it.
 *
 * @param avgDailyCalories mean intake across the logged days.
 * @param weightChangePerWeekKg signed: negative is loss.
 */
export function observedTdee(avgDailyCalories: number, weightChangePerWeekKg: number): number {
  return Math.round(avgDailyCalories - (weightChangePerWeekKg * KCAL_PER_KG) / 7);
}

/** Blend the new observation into the standing estimate, capped both ways. */
export function smoothTdee(previousTdee: number, observed: number): number {
  const blended = (1 - OBSERVED_WEIGHT) * previousTdee + OBSERVED_WEIGHT * observed;
  const delta = Math.max(
    -MAX_TDEE_CORRECTION,
    Math.min(MAX_TDEE_CORRECTION, blended - previousTdee),
  );
  return Math.round(previousTdee + delta);
}

/**
 * @param weighIns last 14 days of weigh-ins, any order.
 * @param intake last 14 days of logged daily totals, any order. Pass [] when
 *        the caller has none — the nudge path handles it.
 * @param windowEnd ISO date (YYYY-MM-DD) of the last day of the window.
 * Returns null when no rule fires (on track, wrong goal, or too little data).
 */
export function proposeDietAdaptation(
  goal: string | null,
  targets: CurrentTargets,
  weighIns: WeighIn[],
  windowEnd: string,
  intake: IntakeDay[] = [],
): DietProposal | null {
  if (!goal || !(goal in GOAL_FACTOR)) return null;

  // Split the 14-day window into prior week / recent week by date.
  const end = new Date(`${windowEnd}T00:00:00Z`);
  const splitDate = new Date(end);
  splitDate.setUTCDate(splitDate.getUTCDate() - 6);
  const split = splitDate.toISOString().slice(0, 10);

  const recent = weighIns.filter((w) => w.date >= split).map((w) => w.weightKg);
  const prior = weighIns.filter((w) => w.date < split).map((w) => w.weightKg);
  if (recent.length < 2 || prior.length < 2) return null;

  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  const trendKg = Math.round((recentAvg - priorAvg) * 100) / 100;
  const bodyweight = recentAvg;

  const loggedCalories = intake.map((d) => d.calories).filter((c) => c > 0);

  let reasonKey: DietAdaptationReason | null = null;
  let targetCalories: number;
  let newTdee = targets.tdee;
  let observed: number | null = null;

  if (loggedCalories.length >= MIN_LOGGED_DAYS) {
    // ---- CALIBRATE ----
    observed = observedTdee(avg(loggedCalories), trendKg);
    newTdee = smoothTdee(targets.tdee, observed);
    if (newTdee === targets.tdee) return null; // the estimate already fits
    targetCalories = Math.round((newTdee * GOAL_FACTOR[goal]) / 10) * 10;
    reasonKey = newTdee > targets.tdee ? "adapt.calibrated_up" : "adapt.calibrated_down";
  } else {
    // ---- NUDGE ---- weight trend only; ±100 kcal/day, per the sheet.
    // Maintenance and recomp have no pace to be off, so nothing fires for them.
    let deltaKcal = 0;
    if (goal === "lose_fat") {
      if (trendKg > -0.2) {
        // Stall (or gain) on a cut across a full week-over-week comparison.
        reasonKey = "adapt.cut_stall";
        deltaKcal = -100;
      } else if (trendKg < -(bodyweight * 0.015)) {
        // Losing >1.5 % bodyweight per week — too fast, muscle is at risk.
        reasonKey = "adapt.cut_too_fast";
        deltaKcal = 100;
      }
    } else if (goal === "build_muscle") {
      if (trendKg < 0.1) {
        reasonKey = "adapt.bulk_stall";
        deltaKcal = 100;
      } else if (trendKg > bodyweight * 0.01) {
        // Gaining >1 % bodyweight per week — mostly fat at that pace.
        reasonKey = "adapt.bulk_too_fast";
        deltaKcal = -100;
      }
    }
    if (!reasonKey || deltaKcal === 0) return null;
    targetCalories = targets.calories + deltaKcal;
  }

  // ---- Clamps ----
  const maxSwing = Math.round(targets.calories * 0.1);
  let newCalories = roundTo25(
    Math.max(
      targets.calories - maxSwing,
      Math.min(targets.calories + maxSwing, targetCalories),
    ),
  );
  const floor = Math.max(CALORIE_FLOOR, targets.bmr);
  if (newCalories < floor) newCalories = roundTo25(floor);
  const actualDelta = newCalories - targets.calories;
  if (actualDelta === 0) return null;

  // ---- Distribute the delta: 60% carbs / 40% fat, protein untouched ----
  let newCarbsG = Math.round(targets.carbsG + (actualDelta * 0.6) / KCAL_PER_G_CARB);
  let newFatG = Math.round(targets.fatG + (actualDelta * 0.4) / KCAL_PER_G_FAT);
  if (newCarbsG < MIN_CARBS_G) newCarbsG = MIN_CARBS_G;
  if (newFatG < MIN_FAT_G) newFatG = MIN_FAT_G;

  return {
    reasonKey,
    deltaKcal: actualDelta,
    oldCalories: targets.calories,
    newCalories,
    newProteinG: targets.proteinG,
    newCarbsG,
    newFatG,
    trendKg,
    newTdee,
    observedTdee: observed,
  };
}
