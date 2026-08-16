"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getRedoQuota, MONTHLY_REDO_LIMIT, REDO_QUOTA_ERROR } from "@/lib/plan-redo";
import {
  MAX_EXERCISES_PER_DAY,
  MAX_REST_SECONDS,
  MAX_SETS,
  REP_RANGE_PATTERN,
} from "@/lib/program-limits";
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
/**
 * Signed in is enough — building a program is the free half of the product.
 *
 * This is the moment the reverse trial is built around: somebody who has just
 * watched their own split appear is in a position to judge whether the app is
 * worth paying for, which the old checkout page never gave them. Recording a
 * session against that program is still paid; generating it is not.
 *
 * Not an unlimited-work hole: the monthly redo quota below bounds how often one
 * account can regenerate, and it applies to free and paid users alike.
 */
export async function submitWorkoutQuestions(answers: WorkoutAnswers): Promise<ActionResult<{ programId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const { data: previous } = await supabase
    .from("training_profiles")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  // Same monthly cap as the diet side, counted separately: a second profile is
  // a rebuild. Checked before archiving so a blocked redo costs nothing.
  if (previous) {
    const quota = await getRedoQuota(supabase, user.id, "workout");
    if (quota.remaining <= 0) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(quota.limit)));
    }
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
  if (error || !trainingProfile) {
    // Backstop for direct POSTs — the trigger, not this action, is the gate.
    if (error?.message.includes(REDO_QUOTA_ERROR)) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(MONTHLY_REDO_LIMIT)));
    }
    return fail(error?.message ?? "Could not save your answers.");
  }

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
    .select(
      "day_number, day_name_en, fixed_split_exercises(order_index, exercise_id, reps, advice_en, advice_ar)",
    )
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
          notes_ar: e.advice_ar,
        };
      }),
    );
  }

  return ok({ programId: userProgram.id });
}

/**
 * `user_program_exercises` has no CHECK constraints on these columns, so
 * whatever arrives here is what the session recorder will render. The bounds in
 * `program-limits` are far outside anything the editor's steppers can produce;
 * they exist to stop a direct POST writing 10,000 sets or a rep range of
 * arbitrary length into a row every workout screen then has to display.
 */
export async function saveProgramExerciseEdit(
  rowId: string,
  patch: { sets?: number; repRange?: string; restSeconds?: number },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const update: { sets?: number; rep_range?: string; rest_seconds?: number; is_user_modified: boolean } = {
    is_user_modified: true,
  };

  if (patch.sets !== undefined) {
    const sets = Math.round(Number(patch.sets));
    if (!Number.isFinite(sets) || sets < 1 || sets > MAX_SETS) {
      return fail("That set count doesn't look right.");
    }
    update.sets = sets;
  }
  if (patch.repRange !== undefined) {
    const repRange = String(patch.repRange).trim();
    if (!REP_RANGE_PATTERN.test(repRange)) return fail("That rep range doesn't look right.");
    update.rep_range = repRange;
  }
  if (patch.restSeconds !== undefined) {
    const rest = Math.round(Number(patch.restSeconds));
    if (!Number.isFinite(rest) || rest < 0 || rest > MAX_REST_SECONDS) {
      return fail("That rest time doesn't look right.");
    }
    update.rest_seconds = rest;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_program_exercises").update(update).eq("id", rowId);
  if (error) return fail(error.message);
  return ok(undefined);
}

/**
 * Shaping the program is free, like generating it.
 *
 * Somebody whose gym lacks the machine, or whose shoulder rules the movement
 * out, cannot judge a plan they are unable to make usable — and the
 * questionnaire already asked about equipment and injuries, so refusing the
 * swap contradicts what we asked. Recording a session against the program is
 * still what the subscription buys.
 *
 * These used to require payment while the editor updated its own state first,
 * so a free user watched the swap happen, the write got refused, and the old
 * exercise came back on reload. Failing was bad; appearing to succeed was worse.
 */
export async function swapProgramExercise(rowId: string, newExerciseId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_program_exercises")
    .update({ exercise_id: newExerciseId, is_user_modified: true })
    .eq("id", rowId);
  if (error) return fail(error.message);
  return ok(undefined);
}

/**
 * Add an exercise to a day of an existing program.
 *
 * The counterpart to the swap picker, and the other half of "fill a split with
 * the exercises you choose": swapping trades one movement for another, this is
 * for a day that is simply missing something. Free, for the same reason swapping
 * is — a program you cannot finish shaping is not a program you can judge.
 *
 * `order_index` is computed here rather than sent: the client's idea of the
 * order is whatever it last rendered, and two adds in flight at once would
 * collide on it.
 */
export async function addProgramExercise(
  dayId: string,
  exerciseId: string,
): Promise<ActionResult<{ id: string; orderIndex: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const supabase = await createClient();

  // Ownership is enforced by RLS on every table below, but this join also gets
  // us the current tail of the day in the same round-trip, and it turns "the
  // insert silently affected nothing" into a sentence a user can act on.
  const { data: day } = await supabase
    .from("user_program_days")
    .select("id, user_programs!inner(id, user_id)")
    .eq("id", dayId)
    .eq("user_programs.user_id", user.id)
    .maybeSingle();
  if (!day) return fail("That workout day isn't yours.");

  const { data: existing } = await supabase
    .from("user_program_exercises")
    .select("exercise_id, order_index")
    .eq("user_program_day_id", dayId)
    .order("order_index", { ascending: false });

  const rows = existing ?? [];
  if (rows.length >= MAX_EXERCISES_PER_DAY) {
    return fail(`A day can hold at most ${MAX_EXERCISES_PER_DAY} exercises.`);
  }
  if (rows.some((r) => r.exercise_id === exerciseId)) {
    return fail("That exercise is already in this day.");
  }

  const orderIndex = (rows[0]?.order_index ?? -1) + 1;
  const { data: inserted, error } = await supabase
    .from("user_program_exercises")
    .insert({
      user_program_day_id: dayId,
      exercise_id: exerciseId,
      order_index: orderIndex,
      sets: 3,
      rep_range: "8-12",
      rest_seconds: 90,
      is_user_modified: true,
    })
    .select("id")
    .single();
  if (error || !inserted) return fail(error?.message ?? "Could not add that exercise.");

  return ok({ id: inserted.id, orderIndex });
}

/**
 * Drop an exercise from a day.
 *
 * Refuses to empty a day: `/workout/program` renders a day with no exercises as
 * a trainable session with nothing in it, and the session recorder would open
 * on a blank list. Removing the last one is nearly always a mis-tap, and when it
 * isn't, the thing the user wants is a different exercise — which is the swap.
 */
export async function removeProgramExercise(rowId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("user_program_exercises")
    .select("id, user_program_day_id")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return fail("That exercise isn't in your program.");

  const { count } = await supabase
    .from("user_program_exercises")
    .select("id", { count: "exact", head: true })
    .eq("user_program_day_id", row.user_program_day_id);
  if ((count ?? 0) <= 1) return fail("A training day needs at least one exercise.");

  const { error } = await supabase.from("user_program_exercises").delete().eq("id", rowId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function markProgramModified(programId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("user_programs")
    .update({ user_modified: true })
    .eq("id", programId)
    .eq("user_id", user.id);
}

export async function redoWorkoutGoals() {
  redirect("/workout/questions?redo=1");
}
