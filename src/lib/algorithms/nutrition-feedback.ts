/**
 * Rule-based nutrition coach (V1.5). Pure and deterministic: consumed vs.
 * target plus time of day in, ordered i18n message keys out. The LLM never
 * decides here — rules decide, copy is templated (EN + Derja in i18n.ts).
 */

export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type CoachMessageKey =
  | "coach.log_reminder"
  | "coach.protein_behind"
  | "coach.protein_hit"
  | "coach.calories_over"
  | "coach.calories_low_evening"
  | "coach.fat_high"
  | "coach.great_day"
  | "coach.on_track";

/** Rough share of daily intake we expect to be eaten by a given hour. */
function expectedPaceByHour(hour: number): number {
  if (hour < 10) return 0.15;
  if (hour < 14) return 0.4;
  if (hour < 18) return 0.6;
  if (hour < 21) return 0.85;
  return 1;
}

/**
 * Returns at most `limit` messages, most important first.
 * `hour` is the user's local hour (0-23).
 */
export function nutritionFeedback(
  consumed: MacroTotals,
  target: MacroTotals,
  hour: number,
  limit = 2,
): CoachMessageKey[] {
  const messages: CoachMessageKey[] = [];
  const hasLogs =
    consumed.calories > 0 || consumed.proteinG > 0 || consumed.carbsG > 0 || consumed.fatG > 0;

  if (!hasLogs) {
    return hour >= 12 ? ["coach.log_reminder"] : [];
  }
  if (target.calories <= 0) return [];

  const pace = expectedPaceByHour(hour);
  const proteinRatio = consumed.proteinG / Math.max(target.proteinG, 1);
  const calorieRatio = consumed.calories / target.calories;

  // End-of-day verdicts first (they subsume pace advice).
  const dayMostlyOver = hour >= 20;
  if (dayMostlyOver && calorieRatio >= 0.9 && calorieRatio <= 1.07 && proteinRatio >= 0.9) {
    messages.push("coach.great_day");
  }

  if (calorieRatio > 1.1) {
    messages.push("coach.calories_over");
  } else if (dayMostlyOver && calorieRatio < 0.7) {
    messages.push("coach.calories_low_evening");
  }

  if (proteinRatio >= 1) {
    messages.push("coach.protein_hit");
  } else if (hour >= 15 && proteinRatio < 0.6 * pace) {
    messages.push("coach.protein_behind");
  }

  if (consumed.fatG > target.fatG * 1.35) {
    messages.push("coach.fat_high");
  }

  if (messages.length === 0 && calorieRatio >= 0.5 * pace) {
    messages.push("coach.on_track");
  }

  return messages.slice(0, limit);
}
