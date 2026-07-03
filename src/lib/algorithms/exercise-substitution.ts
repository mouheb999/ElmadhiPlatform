/**
 * Layer 1 (hard filters) + Layer 3 (preference scoring) for the workout
 * engine — personalization-engine.md §3, §4, §6.
 *
 * The substitution_group table itself (§4) lives in seed data on
 * `exercises.substitution_group`, transcribed from AbuzWorkoutSplits.pdf's
 * Exercise Variations section. This file only implements the filter/score
 * logic that consumes it.
 */

export type ExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "kettlebell"
  | "band";

export type TrainingEquipment = "full_gym" | "home_basic" | "home_advanced" | "bodyweight";
export type Experience = "beginner" | "intermediate" | "advanced";

export type ExerciseRow = {
  id: string;
  primary_muscle: string;
  equipment: string;
  substitution_group: string | null;
  contraindicated_for: string[] | null;
  difficulty: string | null;
};

/**
 * Maps where a user trains to which exercise-equipment values are physically
 * available to them. Not sourced from either PDF — a reasonable reading of
 * `architecture.md`'s existing `training_profiles.equipment` enum.
 */
const EQUIPMENT_ACCESS: Record<TrainingEquipment, ExerciseEquipment[]> = {
  full_gym: ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "band"],
  home_advanced: ["barbell", "dumbbell", "bodyweight", "kettlebell", "band"],
  home_basic: ["dumbbell", "bodyweight", "band"],
  bodyweight: ["bodyweight"],
};

export function availableEquipmentFor(trainingEquipment: TrainingEquipment): ExerciseEquipment[] {
  return EQUIPMENT_ACCESS[trainingEquipment];
}

/** Layer 1 — safety/feasibility filter. Never violated. */
export function isExerciseAllowed(
  exercise: ExerciseRow,
  opts: { injuries: string[]; trainingEquipment: TrainingEquipment },
): boolean {
  const allowedEquipment = availableEquipmentFor(opts.trainingEquipment);
  if (!allowedEquipment.includes(exercise.equipment as ExerciseEquipment)) return false;

  if (exercise.contraindicated_for?.length && opts.injuries.length) {
    const conflicts = exercise.contraindicated_for.some((c) => opts.injuries.includes(c));
    if (conflicts) return false;
  }
  return true;
}

export function filterSafeExercises(
  pool: ExerciseRow[],
  opts: { injuries: string[]; trainingEquipment: TrainingEquipment },
): ExerciseRow[] {
  return pool.filter((e) => isExerciseAllowed(e, opts));
}

/**
 * Rule W1 (personalization-engine.md §4) — beginners get machine/cable
 * variants of a movement before free-weight compounds, matching the source
 * material's own stated philosophy (build stability before technique).
 */
export function applyBeginnerEquipmentBias(
  candidates: ExerciseRow[],
  experience: Experience,
): ExerciseRow[] {
  if (experience !== "beginner") return candidates;
  const controlled = candidates.filter((c) => c.equipment === "machine" || c.equipment === "cable");
  return controlled.length > 0 ? controlled : candidates;
}

/**
 * Finds a safe substitute for `target`. Tries the same substitution_group
 * first (the PDF's own equivalence groups); falls back to same primary
 * muscle only if the group has no clean option, per personalization-engine.md
 * §4's tightened swap rule.
 */
export function findSubstitute(
  target: ExerciseRow,
  pool: ExerciseRow[],
  opts: { injuries: string[]; trainingEquipment: TrainingEquipment; experience: Experience },
): ExerciseRow | null {
  const safePool = filterSafeExercises(pool, opts).filter((e) => e.id !== target.id);

  const sameGroup = target.substitution_group
    ? safePool.filter((e) => e.substitution_group === target.substitution_group)
    : [];
  const candidates = sameGroup.length > 0
    ? sameGroup
    : safePool.filter((e) => e.primary_muscle === target.primary_muscle);

  const biased = applyBeginnerEquipmentBias(candidates, opts.experience);
  return biased[0] ?? candidates[0] ?? null;
}

/** Layer 3 — preference scoring within an already-safe candidate set. */
export function scoreExercise(
  exercise: ExerciseRow,
  opts: { favoriteExerciseIds: string[]; weakMuscles: string[] },
): number {
  let score = 0;
  if (opts.favoriteExerciseIds.includes(exercise.id)) score += 10;
  if (opts.weakMuscles.includes(exercise.primary_muscle)) score += 5;
  return score;
}

export function rankByPreference<T extends ExerciseRow>(
  candidates: T[],
  opts: { favoriteExerciseIds: string[]; weakMuscles: string[] },
): T[] {
  return [...candidates].sort((a, b) => scoreExercise(b, opts) - scoreExercise(a, opts));
}
