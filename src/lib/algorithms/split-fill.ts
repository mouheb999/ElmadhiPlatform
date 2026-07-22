/**
 * Questionnaire helpers.
 *
 * The slot-filling workout generator that used to live here — `generateProgram`,
 * `fillDay`, `selectForBlock`, `rankByTier`, `orderDay`, the tier/role model and
 * the `sets_reps_by_style` schemes — was retired in migration 027. Programs are
 * no longer assembled from a candidate pool: `submitWorkoutQuestions` now matches
 * one of the 10 pre-built `fixed_splits` (by gender + days_per_week) and copies
 * its fixed exercises verbatim.
 *
 * What remains are two pure helpers the questionnaire UI and the manual swap
 * picker still need. Everything here is data-in/data-out with no Supabase import.
 */

/**
 * Evaluates `questionnaire_questions.shown_if` — a map of question id to the
 * answers that reveal this question. All entries must match. An unanswered
 * dependency keeps the question hidden, so `equipment_gym` stays out of the
 * flow until `location` is actually answered.
 */
export function isQuestionVisible(
  shownIf: Record<string, string[]> | null | undefined,
  answers: Record<string, string | string[] | undefined>,
): boolean {
  if (!shownIf) return true;
  return Object.entries(shownIf).every(([dependsOn, allowed]) => {
    const given = answers[dependsOn];
    return typeof given === "string" && allowed.includes(given);
  });
}

/**
 * Turns the questionnaire's `location` + `equipment_gym` + `equipment_home`
 * answers into the flat `exercises.equipment` values the manual swap picker
 * filters on, using `questionnaire_rules.equipment_option_map`.
 *
 * "Pull-up bar" maps to `bodyweight` because the catalog has no separate value
 * for it. Bodyweight is always included regardless of what was ticked.
 */
export function resolveEquipmentValues(
  answers: { location?: string; equipment_gym?: string[]; equipment_home?: string[] },
  optionMap: Record<string, string>,
): string[] {
  const picked: string[] = [];
  const atGym = answers.location === "Gym only" || answers.location === "Home + Gym (hybrid)";
  const atHome = answers.location === "Home only" || answers.location === "Home + Gym (hybrid)";
  if (atGym) picked.push(...(answers.equipment_gym ?? []));
  if (atHome) picked.push(...(answers.equipment_home ?? []));

  const values = picked.map((o) => optionMap[o]).filter((v): v is string => Boolean(v));
  if (!values.includes("bodyweight")) values.push("bodyweight");
  return [...new Set(values)];
}
