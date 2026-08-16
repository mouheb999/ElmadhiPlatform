"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getRedoQuota, MONTHLY_REDO_LIMIT, REDO_QUOTA_ERROR } from "@/lib/plan-redo";
import {
  MAX_EXERCISES_PER_DAY,
  MAX_PROGRAM_DAYS as MAX_DAYS,
  MAX_REST_SECONDS,
  MAX_SETS,
  MIN_PROGRAM_DAYS as MIN_DAYS,
  REP_RANGE_PATTERN,
} from "@/lib/program-limits";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * The other way to get a program: build it yourself.
 *
 * `submitWorkoutQuestions` matches you to one of ten pre-built splits and copies
 * it. That is the right default — most people cannot name the exercises they
 * should be doing, which is what they are paying us for. But some can, and for
 * them the questionnaire is a detour that ends somewhere they were never going
 * to accept: they already know they want Push/Pull/Legs with *their* lifts in it,
 * and their only route to that was to generate a split they didn't want and then
 * swap every row of it one at a time.
 *
 * This writes to exactly the same tables — user_programs, user_program_days,
 * user_program_exercises — so nothing downstream can tell the difference. The
 * session recorder, the weekly gate, the progression maths, /progress, the
 * dashboard: all of it reads a program, not a *generated* program, and none of
 * it was touched.
 *
 * One action, not a row-at-a-time editor, because a half-saved split is worse
 * than no split: the program page would show a Tuesday with nothing in it and no
 * way to tell whether that was a bug or a rest day. The whole thing arrives at
 * once or not at all.
 */

/** What the builder posts. Every field is re-validated below. */
export type CustomProgramInput = {
  /** Answers the guided flow would have collected. Same vocabulary — these are
   *  CHECK-constrained columns and the swap picker reads them back. */
  gender: string;
  goal: string;
  experience: string;
  location?: string;
  equipmentGym?: string[];
  equipmentHome?: string[];
  injuries?: string[];
  /** What the user calls this program. */
  name: string;
  days: CustomDayInput[];
};

export type CustomDayInput = {
  name: string;
  exercises: {
    exerciseId: string;
    sets: number;
    /** "8-12" or "10". Free text in the DB; shape-checked here. */
    repRange: string;
    restSeconds: number;
  }[];
};

/** Longest a user-typed program or day name may be. */
const MAX_NAME_LENGTH = 40;

/**
 * Same vocabulary as `questionnaire_questions.options`, which is what the CHECK
 * constraints in migration 022 were generated from. Validated here as well so a
 * bad value comes back as a sentence instead of a Postgres constraint name.
 */
const GENDERS = ["Male", "Female", "Prefer not to say"];
const GOALS = [
  "Muscle growth (hypertrophy)",
  "Strength",
  "Fat loss",
  "Body recomposition (lose fat + build muscle)",
  "General fitness / home convenience",
];
const EXPERIENCE = ["Beginner (0-6 months)", "Intermediate (6mo-2yrs)", "Advanced (2+ yrs)"];
const LOCATIONS = ["Gym only", "Home only", "Home + Gym (hybrid)"];
const EQUIPMENT_GYM = ["Barbell", "Dumbbells", "Cable machines", "Selectorized machines", "Kettlebell"];
const EQUIPMENT_HOME = ["Dumbbells", "Resistance bands", "Pull-up bar", "Kettlebell", "Bodyweight only"];
const INJURIES = ["None", "Lower back", "Knee", "Shoulder", "Wrist / elbow", "Neck"];

function cleanName(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, MAX_NAME_LENGTH);
}

/** Keeps only values the column's CHECK will accept; drops anything else. */
function allowedSubset(values: unknown, allowed: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((v): v is string => typeof v === "string" && allowed.includes(v)))];
}

/**
 * Validates the whole payload before a single row is written.
 *
 * Returns the shape the inserts use, or a message. Separated from the action so
 * the rules are one readable block rather than a hundred lines of early return
 * interleaved with database calls.
 */
type Validation =
  | { valid: false; error: string }
  | { valid: true; days: CustomDayInput[] };

const invalid = (error: string): Validation => ({ valid: false, error });

function validate(input: CustomProgramInput, knownExerciseIds: Set<string>): Validation {
  if (!GENDERS.includes(input.gender)) return invalid("Pick who the program is for.");
  if (!GOALS.includes(input.goal)) return invalid("Pick a goal for the program.");
  if (!EXPERIENCE.includes(input.experience)) return invalid("Pick your experience level.");

  const days = Array.isArray(input.days) ? input.days : [];
  if (days.length < MIN_DAYS || days.length > MAX_DAYS) {
    return invalid(`A program needs between ${MIN_DAYS} and ${MAX_DAYS} training days.`);
  }

  const cleaned: CustomDayInput[] = [];
  for (const [index, day] of days.entries()) {
    const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
    // An empty day is the one thing the builder must not let through: the
    // program page would render it as a trainable day with nothing to do.
    if (exercises.length === 0) {
      return invalid(`Day ${index + 1} has no exercises yet.`);
    }
    if (exercises.length > MAX_EXERCISES_PER_DAY) {
      return invalid(`Day ${index + 1} has more than ${MAX_EXERCISES_PER_DAY} exercises.`);
    }

    const seen = new Set<string>();
    const cleanedExercises: CustomDayInput["exercises"] = [];
    for (const exercise of exercises) {
      const id = typeof exercise?.exerciseId === "string" ? exercise.exerciseId : "";
      // Checked against the catalog rather than just "is a uuid": the insert
      // has a foreign key, but a rejected batch would surface as a raw
      // constraint error after the program row already exists.
      if (!knownExerciseIds.has(id)) {
        return invalid(`Day ${index + 1} contains an exercise we don't recognise.`);
      }
      // The same lift twice in one day is a mistake every time — the second one
      // is a duplicated tap, not a deliberate second session of it.
      if (seen.has(id)) {
        return invalid(`Day ${index + 1} lists the same exercise twice.`);
      }
      seen.add(id);

      const sets = Math.round(Number(exercise.sets));
      if (!Number.isFinite(sets) || sets < 1 || sets > MAX_SETS) {
        return invalid(`Day ${index + 1} has a set count that doesn't look right.`);
      }

      const repRange = String(exercise.repRange ?? "").trim();
      if (!REP_RANGE_PATTERN.test(repRange)) {
        return invalid(`Day ${index + 1} has a rep range that doesn't look right.`);
      }

      const restSeconds = Math.round(Number(exercise.restSeconds));
      if (!Number.isFinite(restSeconds) || restSeconds < 0 || restSeconds > MAX_REST_SECONDS) {
        return invalid(`Day ${index + 1} has a rest time that doesn't look right.`);
      }

      cleanedExercises.push({ exerciseId: id, sets, repRange, restSeconds });
    }

    cleaned.push({ name: cleanName(day?.name, `Day ${index + 1}`), exercises: cleanedExercises });
  }

  return { valid: true, days: cleaned };
}

/**
 * Free, exactly like `submitWorkoutQuestions`.
 *
 * Building the plan is the half of the product that has to be free for the
 * reverse trial to mean anything; recording a session against it is what the
 * subscription buys. Making the hand-built route paid while the generated one
 * stays free would put the wall in front of the users most likely to pay.
 *
 * Bounded by the same monthly redo quota, counted in the same place: a rebuild
 * is a rebuild whichever screen it came from.
 */
export async function createCustomProgram(
  input: CustomProgramInput,
): Promise<ActionResult<{ programId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  // Validate against the real catalog before touching anything. Only the ids
  // the payload actually names are fetched — the alternative is pulling all 213
  // rows to build a set we use once.
  const requestedIds = [
    ...new Set(
      (Array.isArray(input.days) ? input.days : [])
        .flatMap((d) => (Array.isArray(d?.exercises) ? d.exercises : []))
        .map((e) => e?.exerciseId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  // Cap the lookup itself: MAX_DAYS × MAX_EXERCISES_PER_DAY is the most a valid
  // payload can name, and a larger one is rejected below anyway.
  if (requestedIds.length > MAX_DAYS * MAX_EXERCISES_PER_DAY) {
    return fail("That's more exercises than a program can hold.");
  }
  const { data: known } = requestedIds.length
    ? await supabase.from("exercises").select("id").in("id", requestedIds)
    : { data: [] };

  const validated = validate(input, new Set((known ?? []).map((e) => e.id)));
  if (!validated.valid) return fail(validated.error);
  const days = validated.days;

  const { data: previous } = await supabase
    .from("training_profiles")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  // Checked before archiving, so a blocked rebuild leaves the current program
  // exactly as it was — same order as the guided flow.
  if (previous) {
    const quota = await getRedoQuota(supabase, user.id, "workout");
    if (quota.remaining <= 0) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(quota.limit)));
    }
    await supabase.from("training_profiles").update({ is_active: false }).eq("id", previous.id);
    await supabase.from("user_programs").update({ is_active: false }).eq("training_profile_id", previous.id);
  }

  const { data: trainingProfile, error: profileError } = await supabase
    .from("training_profiles")
    .insert({
      user_id: user.id,
      version: (previous?.version ?? 0) + 1,
      build_mode: "custom",
      days_per_week: days.length,
      goal: input.goal,
      experience: input.experience,
      gender: input.gender,
      location: LOCATIONS.includes(input.location ?? "") ? input.location : null,
      equipment_gym: allowedSubset(input.equipmentGym, EQUIPMENT_GYM),
      equipment_home: allowedSubset(input.equipmentHome, EQUIPMENT_HOME),
      injuries: allowedSubset(input.injuries, INJURIES),
    })
    .select("id")
    .single();

  if (profileError || !trainingProfile) {
    // The trigger from migration 033 is the real cap; this action is reachable
    // by direct POST. Translate its exception into the same sentence.
    if (profileError?.message.includes(REDO_QUOTA_ERROR)) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(MONTHLY_REDO_LIMIT)));
    }
    return fail(profileError?.message ?? "Could not save your program.");
  }

  const { data: program, error: programError } = await supabase
    .from("user_programs")
    .insert({
      user_id: user.id,
      training_profile_id: trainingProfile.id,
      name: cleanName(input.name, "My program"),
      // Not a fixed_splits id — this program was not copied from one. The column
      // is free text and only ever read back for display.
      split_type: "custom",
      is_custom: true,
      user_modified: true,
    })
    .select("id")
    .single();
  if (programError || !program) {
    // The profile is live but has no program hanging off it, and /workout/program
    // redirects to the questionnaire in that state — a dead end. Roll it back so
    // the account is where it started.
    const db = createAdminClient();
    await db.from("training_profiles").delete().eq("id", trainingProfile.id);
    if (previous) {
      await db.from("training_profiles").update({ is_active: true }).eq("id", previous.id);
      await db.from("user_programs").update({ is_active: true }).eq("training_profile_id", previous.id);
    }
    return fail(programError?.message ?? "Could not save your program.");
  }

  for (const [index, day] of days.entries()) {
    const { data: dayRow, error: dayError } = await supabase
      .from("user_program_days")
      .insert({
        user_program_id: program.id,
        day_number: index + 1,
        day_name: day.name,
      })
      .select("id")
      .single();
    if (dayError || !dayRow) {
      await rollback(createAdminClient(), program.id, trainingProfile.id, previous?.id);
      return fail(dayError?.message ?? "Could not save your program.");
    }

    const { error: exercisesError } = await supabase.from("user_program_exercises").insert(
      day.exercises.map((exercise, order) => ({
        user_program_day_id: dayRow.id,
        exercise_id: exercise.exerciseId,
        order_index: order,
        sets: exercise.sets,
        rep_range: exercise.repRange,
        rest_seconds: exercise.restSeconds,
        is_user_modified: true,
      })),
    );
    if (exercisesError) {
      await rollback(createAdminClient(), program.id, trainingProfile.id, previous?.id);
      return fail(exercisesError.message);
    }
  }

  return ok({ programId: program.id });
}

/**
 * Undo a partial build.
 *
 * Postgres has no transaction across separate PostgREST calls, so a failure
 * halfway through leaves a program with some of its days. Deleting the program
 * cascades to days and exercises (migration 004), and reactivating the previous
 * profile puts the user back on the plan they already had rather than on nothing.
 *
 * Runs on the service-role client because migration 045 revoked DELETE on
 * `training_profiles` from users: the monthly rebuild quota is counted by
 * counting those rows, so a user who could delete them could reset their own
 * allowance. Cleaning up our own failed write is a system operation, and the
 * ids it touches are ones this function created moments ago — never anything
 * the caller named.
 */
async function rollback(
  supabase: ReturnType<typeof createAdminClient>,
  programId: string,
  trainingProfileId: string,
  previousProfileId: string | undefined,
): Promise<void> {
  await supabase.from("user_programs").delete().eq("id", programId);
  await supabase.from("training_profiles").delete().eq("id", trainingProfileId);
  if (previousProfileId) {
    await supabase.from("training_profiles").update({ is_active: true }).eq("id", previousProfileId);
    await supabase
      .from("user_programs")
      .update({ is_active: true })
      .eq("training_profile_id", previousProfileId);
  }
}
