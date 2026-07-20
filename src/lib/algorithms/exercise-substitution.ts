/**
 * Layer 1 hard filters — personalization-engine.md §3.
 *
 * Program generation itself moved to `split-fill.ts` in the slot-filling
 * rewrite; what survives here is the safety/feasibility filter used by the
 * program editor to decide which exercises may be offered as a manual swap.
 *
 * The old template-copy helpers (`findSubstitute`, `applyBeginnerEquipmentBias`)
 * were deleted with `program-match.ts` — substitution is now the slot filler's
 * job, and it ranks by `exercise_ratings.tier` rather than swapping one
 * concrete exercise for another.
 */

export type ExerciseRow = {
  id: string;
  /** NULL for the cardio/stretching rows added in migration 019. */
  primary_muscle: string | null;
  equipment: string;
  substitution_group: string | null;
  contraindicated_for: string[] | null;
  difficulty: string | null;
};

/**
 * `equipment` is the already-resolved list of `exercises.equipment` values the
 * user can reach. Migration 022 replaced the old four-tier
 * `training_profiles.equipment` enum with location + two multi-selects, so the
 * mapping lives in `split-fill.resolveEquipmentValues` and this takes the result
 * rather than re-deriving it.
 */
export function isExerciseAllowed(
  exercise: ExerciseRow,
  opts: { injuries: string[]; equipment: string[] },
): boolean {
  if (!opts.equipment.includes(exercise.equipment)) return false;

  if (exercise.contraindicated_for?.length && opts.injuries.length) {
    const conflicts = exercise.contraindicated_for.some((c) => opts.injuries.includes(c));
    if (conflicts) return false;
  }
  return true;
}

export function filterSafeExercises(
  pool: ExerciseRow[],
  opts: { injuries: string[]; equipment: string[] },
): ExerciseRow[] {
  return pool.filter((e) => isExerciseAllowed(e, opts));
}
