/**
 * Weekly calorie-adjustment rules (V2 slice 1). Pure and deterministic:
 * 14 days of weigh-ins + the current targets in, a clamped proposal out.
 * The rules decide; i18n templates explain; no LLM anywhere.
 *
 * Guard-rails, in order of importance:
 *  - Never propose without enough data (≥2 weigh-ins in each half of the
 *    window) — one noisy weigh-in must not move a plan.
 *  - Never adjust more than once per 7 days (cooldown checked by caller
 *    against plan_adaptations).
 *  - Never move calories more than 10% at once, never below BMR (or the
 *    1200 kcal floor when BMR is unknown).
 *  - Protein is never touched: the delta comes from carbs (60%) and fat
 *    (40%), with floors so neither collapses.
 */

export type WeighIn = { date: string; weightKg: number };

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
};

const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;
const MIN_CARBS_G = 50;
const MIN_FAT_G = 30;
const CALORIE_FLOOR = 1200;

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function roundTo25(value: number): number {
  return Math.round(value / 25) * 25;
}

/**
 * @param weighIns last 14 days of weigh-ins, any order.
 * @param windowEnd ISO date (YYYY-MM-DD) of the last day of the window.
 * Returns null when no rule fires (on track, wrong goal, or too little data).
 */
export function proposeDietAdaptation(
  goal: string | null,
  targets: CurrentTargets,
  weighIns: WeighIn[],
  windowEnd: string,
): DietProposal | null {
  if (goal !== "lose_fat" && goal !== "build_muscle") return null;

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

  let reasonKey: DietAdaptationReason | null = null;
  let deltaKcal = 0;

  if (goal === "lose_fat") {
    if (trendKg > -0.2) {
      // Stall (or gain) on a cut across a full week-over-week comparison.
      reasonKey = "adapt.cut_stall";
      deltaKcal = -Math.min(300, Math.max(100, Math.round(targets.calories * 0.07)));
    } else if (trendKg < -(bodyweight * 0.015)) {
      // Losing >1.5% bodyweight per week — too fast, muscle is at risk.
      reasonKey = "adapt.cut_too_fast";
      deltaKcal = 150;
    }
  } else {
    if (trendKg < 0.1) {
      reasonKey = "adapt.bulk_stall";
      deltaKcal = Math.min(300, Math.max(100, Math.round(targets.calories * 0.06)));
    } else if (trendKg > bodyweight * 0.01) {
      // Gaining >1% bodyweight per week — mostly fat at that pace.
      reasonKey = "adapt.bulk_too_fast";
      deltaKcal = -150;
    }
  }

  if (!reasonKey || deltaKcal === 0) return null;

  // ---- Clamps ----
  const maxSwing = Math.round(targets.calories * 0.1);
  deltaKcal = Math.max(-maxSwing, Math.min(maxSwing, deltaKcal));
  const floor = Math.max(CALORIE_FLOOR, targets.bmr);
  let newCalories = roundTo25(targets.calories + deltaKcal);
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
  };
}
