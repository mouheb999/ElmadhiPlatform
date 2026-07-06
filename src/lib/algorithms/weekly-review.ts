/**
 * Weekly review rules (V1.5): 7 days of logged behavior in, a coach summary
 * out — templated i18n keys, deterministic, no LLM. The focus area drives
 * which knowledge cards get surfaced next to the review.
 */

export type WeeklyInput = {
  sessionsDone: number;
  weekTarget: number; // days_per_week, 0 if no program
  loggedDays: number; // distinct days with meal logs
  avgCalories: number | null; // across logged days
  avgProteinG: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  avgSleepH: number | null;
  weightStartKg: number | null;
  weightEndKg: number | null;
  goal: string | null; // diet_profiles.goal
  prCount: number;
};

export type FocusArea = "training" | "nutrition" | "recovery" | null;

export type WeeklySummaryKey =
  | "review.sum_no_data"
  | "review.sum_workouts_great"
  | "review.sum_workouts_ok"
  | "review.sum_workouts_poor"
  | "review.sum_prs"
  | "review.sum_nutrition_great"
  | "review.sum_nutrition_poor"
  | "review.sum_protein_low"
  | "review.sum_sleep_low"
  | "review.sum_weight_cut_good"
  | "review.sum_weight_cut_stall"
  | "review.sum_weight_bulk_good";

export type WeeklySummary = {
  keys: WeeklySummaryKey[];
  focus: FocusArea;
};

export function weeklySummary(input: WeeklyInput): WeeklySummary {
  const keys: WeeklySummaryKey[] = [];
  let focus: FocusArea = null;

  const noTrainingData = input.weekTarget === 0 || input.sessionsDone === 0;
  if (noTrainingData && input.loggedDays === 0) {
    return { keys: ["review.sum_no_data"], focus: null };
  }

  // Training
  if (input.weekTarget > 0) {
    const ratio = input.sessionsDone / input.weekTarget;
    if (ratio >= 0.85) {
      keys.push("review.sum_workouts_great");
    } else if (ratio >= 0.5) {
      keys.push("review.sum_workouts_ok");
    } else {
      keys.push("review.sum_workouts_poor");
      focus = "training";
    }
  }
  if (input.prCount > 0) keys.push("review.sum_prs");

  // Nutrition logging
  if (input.loggedDays >= 5) {
    keys.push("review.sum_nutrition_great");
  } else if (input.loggedDays <= 2) {
    keys.push("review.sum_nutrition_poor");
    focus = focus ?? "nutrition";
  }

  // Protein quality (only meaningful with some logging)
  if (
    input.loggedDays >= 2 &&
    input.avgProteinG !== null &&
    input.proteinTargetG !== null &&
    input.proteinTargetG > 0 &&
    input.avgProteinG < 0.8 * input.proteinTargetG
  ) {
    keys.push("review.sum_protein_low");
    focus = focus ?? "nutrition";
  }

  // Recovery
  if (input.avgSleepH !== null && input.avgSleepH < 6.75) {
    keys.push("review.sum_sleep_low");
    focus = focus ?? "recovery";
  }

  // Weight trend, interpreted through the goal
  if (input.weightStartKg !== null && input.weightEndKg !== null) {
    const delta = input.weightEndKg - input.weightStartKg;
    if (input.goal === "lose_fat") {
      if (delta <= -0.3) keys.push("review.sum_weight_cut_good");
      else if (Math.abs(delta) < 0.3) keys.push("review.sum_weight_cut_stall");
    } else if (input.goal === "build_muscle" && delta >= 0.2) {
      keys.push("review.sum_weight_bulk_good");
    }
  }

  return { keys: keys.slice(0, 4), focus };
}
