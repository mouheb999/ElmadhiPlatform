"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Keyed by `questionnaire_questions.id`; values are the English option strings,
 * which are what every CHECK constraint uses. Single-selects hold a string,
 * multi-selects an array.
 */
export type WorkoutAnswers = Record<string, string | string[]>;

const str = (a: WorkoutAnswers, k: string): string | undefined =>
  typeof a[k] === "string" ? (a[k] as string) : undefined;

const arr = (a: WorkoutAnswers, k: string): string[] =>
  Array.isArray(a[k]) ? (a[k] as string[]) : [];

/**
 * Only Male and Female splits exist. "Prefer not to say" falls back to the Male
 * track — the sheet's male full-body/PPL templates are the general-purpose
 * default, and gender only selects which of the two pre-built tracks is served.
 */
function splitGender(gender: string | undefined): "Male" | "Female" {
  return gender === "Female" ? "Female" : "Male";
}

/**
 * The sheet prescribes reps per exercise but no sets/rest. Derive a sane default
 * from the rep range: lower reps mean a heavier, more compound lift, so give it
 * more sets and longer rest. The rep range itself is always stored verbatim.
 */
function schemeForReps(reps: string): { sets: number; restSeconds: number } {
  const hi = Number(reps.split("-").pop());
  if (Number.isFinite(hi) && hi <= 10) return { sets: 4, restSeconds: 120 };
  if (Number.isFinite(hi) && hi <= 15) return { sets: 3, restSeconds: 90 };
  return { sets: 3, restSeconds: 60 };
}

/**
 * Builds a program by matching the user to one pre-built split and copying it.
 *
 * There is no candidate pool, ranking, or slot filling any more (retired in
 * migration 027): gender + days_per_week resolve to exactly one `fixed_splits`
 * row, and its `fixed_split_exercises` are copied straight into the user's
 * program with the sheet's reps and coaching advice. equipment/injury answers
 * are stored for the manual swap picker but never change what is generated.
 */
export async function submitWorkoutQuestions(answers: WorkoutAnswers): Promise<ActionResult<{ programId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { data: previous } = await supabase
    .from("training_profiles")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (previous) {
    await supabase.from("training_profiles").update({ is_active: false }).eq("id", previous.id);
    await supabase.from("user_programs").update({ is_active: false }).eq("training_profile_id", previous.id);
  }

  const goal = str(answers, "goal");
  const experience = str(answers, "experience");
  const gender = str(answers, "gender");
  const daysPerWeek = Number(str(answers, "days_per_week"));
  if (!goal || !experience || !gender || !Number.isFinite(daysPerWeek)) {
    return fail("Some required answers are missing.");
  }

  const { data: trainingProfile, error } = await supabase
    .from("training_profiles")
    .insert({
      user_id: user.id,
      version: (previous?.version ?? 0) + 1,
      days_per_week: daysPerWeek,
      goal,
      experience,
      gender,
      location: str(answers, "location"),
      equipment_gym: arr(answers, "equipment_gym"),
      equipment_home: arr(answers, "equipment_home"),
      pregnancy_status: str(answers, "pregnancy_status"),
      injuries: arr(answers, "injuries"),
      recovery_capacity: str(answers, "recovery_capacity"),
    })
    .select("id")
    .single();
  if (error || !trainingProfile) return fail(error?.message ?? "Could not save your answers.");

  // ---- match one pre-built split: gender + days, nothing else ----
  const { data: split } = await supabase
    .from("fixed_splits")
    .select("id, title_en")
    .eq("gender", splitGender(gender))
    .eq("days_per_week", daysPerWeek)
    .maybeSingle();
  if (!split) {
    return fail(`No split is defined for ${splitGender(gender)} / ${daysPerWeek} days — run migration 027.`);
  }

  const { data: dayRows } = await supabase
    .from("fixed_split_days")
    .select("day_number, day_name_en, fixed_split_exercises(order_index, exercise_id, reps, advice_en)")
    .eq("fixed_split_id", split.id)
    .order("day_number", { ascending: true });
  if (!dayRows || dayRows.length === 0) return fail(`Split "${split.id}" has no days defined.`);

  // ---- persist ----
  const { data: userProgram, error: programError } = await supabase
    .from("user_programs")
    .insert({
      user_id: user.id,
      training_profile_id: trainingProfile.id,
      // The split titles carry a trailing gender ("… Male") used only to keep
      // the sheet's rows distinct; the user never needs to see it.
      name: split.title_en.replace(/\s+(Male|Female)$/i, ""),
      split_type: split.id,
    })
    .select("id")
    .single();
  if (programError || !userProgram) return fail(programError?.message ?? "Could not create your program.");

  for (const day of dayRows) {
    const { data: userDay } = await supabase
      .from("user_program_days")
      .insert({
        user_program_id: userProgram.id,
        day_number: day.day_number,
        day_name: day.day_name_en,
      })
      .select("id")
      .single();

    const exercises = [...(day.fixed_split_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
    if (!userDay || exercises.length === 0) continue;

    await supabase.from("user_program_exercises").insert(
      exercises.map((e, i) => {
        const scheme = schemeForReps(e.reps);
        return {
          user_program_day_id: userDay.id,
          exercise_id: e.exercise_id,
          order_index: i,
          sets: scheme.sets,
          rep_range: e.reps,
          rest_seconds: scheme.restSeconds,
          notes: e.advice_en,
        };
      }),
    );
  }

  return ok({ programId: userProgram.id });
}

export async function saveProgramExerciseEdit(
  rowId: string,
  patch: { sets?: number; repRange?: string; restSeconds?: number },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_program_exercises")
    .update({
      ...(patch.sets !== undefined ? { sets: patch.sets } : {}),
      ...(patch.repRange !== undefined ? { rep_range: patch.repRange } : {}),
      ...(patch.restSeconds !== undefined ? { rest_seconds: patch.restSeconds } : {}),
      is_user_modified: true,
    })
    .eq("id", rowId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function swapProgramExercise(rowId: string, newExerciseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_program_exercises")
    .update({ exercise_id: newExerciseId, is_user_modified: true })
    .eq("id", rowId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function markProgramModified(programId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("user_programs").update({ user_modified: true }).eq("id", programId);
}

export async function redoWorkoutGoals() {
  redirect("/workout/questions?redo=1");
}
