"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import {
  resolveSplitId,
  resolveEquipmentValues,
  requiresHomeFriendly,
  expandDislikes,
  generateProgram,
  type Candidate,
  type SplitDay,
  type UnfilledSlot,
} from "@/lib/algorithms/split-fill";

/**
 * Keyed by `questionnaire_questions.id`; values are the English option strings,
 * which are what every CHECK constraint and `questionnaire_rules` lookup uses.
 * Single-selects hold a string, multi-selects an array.
 */
export type WorkoutAnswers = Record<string, string | string[]>;

const str = (a: WorkoutAnswers, k: string): string | undefined =>
  typeof a[k] === "string" ? (a[k] as string) : undefined;

const arr = (a: WorkoutAnswers, k: string): string[] =>
  Array.isArray(a[k]) ? (a[k] as string[]) : [];

/** "None"-style options mean "no answer", not a value to match against. */
const meaningful = (values: string[]): string[] =>
  values.filter((v) => !/^None\b/i.test(v) && !/^Balanced physique/i.test(v));

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
  const daysPerWeek = Number(str(answers, "days_per_week"));
  if (!goal || !experience || !Number.isFinite(daysPerWeek)) {
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
      session_duration: str(answers, "session_duration"),
      location: str(answers, "location"),
      equipment_gym: arr(answers, "equipment_gym"),
      equipment_home: arr(answers, "equipment_home"),
      training_style: str(answers, "training_style"),
      pullup_ability: str(answers, "pullup_ability"),
      lift_comfort: arr(answers, "lift_comfort"),
      age_bracket: str(answers, "age_bracket"),
      gender: str(answers, "gender"),
      pregnancy_status: str(answers, "pregnancy_status"),
      injuries: arr(answers, "injuries"),
      body_focus: arr(answers, "body_focus"),
      exercise_dislikes: arr(answers, "exercise_dislikes"),
      weight_goal: str(answers, "weight_goal"),
      cardio_preference: str(answers, "cardio_preference"),
      recovery_capacity: str(answers, "recovery_capacity"),
    })
    .select("id")
    .single();
  if (error || !trainingProfile) return fail(error?.message ?? "Could not save your answers.");

  // ---- config: routing + every name-level exclusion rule ----
  const { data: ruleRows } = await supabase
    .from("questionnaire_rules")
    .select("key, payload")
    .in("key", [
      "split_recommendation_logic",
      "slot_count_adjustment_by_duration",
      "body_focus_boost",
      "equipment_option_map",
      "dislike_option_expansion",
      "age_based_exclusions",
      "pregnancy_postpartum_rules",
    ]);

  const rules = Object.fromEntries((ruleRows ?? []).map((r) => [r.key, r.payload])) as Record<string, never>;
  const routing = rules.split_recommendation_logic as
    | Record<string, Record<string, string>>
    | undefined;
  if (!routing) return fail("Split routing rules are missing — run migration 019.");

  const splitId = resolveSplitId(routing, { daysPerWeek, goal, experience });
  if (!splitId) return fail(`No split is defined for ${daysPerWeek} days per week.`);

  const { data: split } = await supabase
    .from("split_definitions")
    .select("id, label_en")
    .eq("id", splitId)
    .maybeSingle();
  if (!split) return fail(`Split "${splitId}" is missing from split_definitions.`);

  // ---- the split's days and their muscle slots ----
  const { data: dayRows } = await supabase
    .from("split_days")
    .select("day_number, day_name_en, day_name_ar, split_day_slots(primary_muscle, exercise_slots, preferred_tiers, order_index)")
    .eq("split_id", splitId)
    .order("day_number", { ascending: true });

  const days: SplitDay[] = (dayRows ?? []).map((d) => ({
    day_number: d.day_number,
    day_name_en: d.day_name_en,
    day_name_ar: d.day_name_ar,
    slots: (d.split_day_slots ?? []) as SplitDay["slots"],
  }));
  if (days.length === 0) return fail(`Split "${splitId}" has no days defined.`);

  // ---- candidate pool: exercises joined to their tier/home rating ----
  const { data: exerciseRows } = await supabase
    .from("exercises")
    .select("id, name_en, primary_muscle, equipment, contraindicated_for, substitution_group, role, sub_target, true_max_effort, exercise_ratings(tier, home_friendly)");

  const pool: Candidate[] = (exerciseRows ?? []).flatMap((e) => {
    const rating = Array.isArray(e.exercise_ratings) ? e.exercise_ratings[0] : e.exercise_ratings;
    if (!rating) return [];
    return [{
      id: e.id,
      name_en: e.name_en,
      primary_muscle: e.primary_muscle,
      equipment: e.equipment,
      tier: rating.tier as Candidate["tier"],
      home_friendly: rating.home_friendly,
      contraindicated_for: e.contraindicated_for,
      substitution_group: e.substitution_group,
      role: e.role as Candidate["role"],
      sub_target: e.sub_target,
      true_max_effort: e.true_max_effort,
    }];
  });

  // Every name-level rule funnels into one exclusion list — they behave
  // identically once resolved to exercise names.
  const location = str(answers, "location");
  const ageRules = (rules.age_based_exclusions ?? {}) as Record<string, string[]>;
  const pregRules = (rules.pregnancy_postpartum_rules ?? {}) as Record<
    string,
    { exclude_exercises?: string[]; exclude_muscle_groups?: string[] }
  >;
  const pregnancy = str(answers, "pregnancy_status");
  const pregRule = pregnancy ? pregRules[pregnancy] : undefined;

  const excludedNames = [
    ...expandDislikes(
      meaningful(arr(answers, "exercise_dislikes")),
      (rules.dislike_option_expansion ?? {}) as Record<string, string[]>,
    ),
    // A lift the user isn't confident in is excluded by name only, not by
    // muscle — comfort_based_substitution in questionnaire_rules.
    ...meaningful(arr(answers, "lift_comfort")),
    ...(ageRules[str(answers, "age_bracket") ?? ""] ?? []),
    ...(pregRule?.exclude_exercises ?? []),
    // "Can't do a full one yet" removes the standard Pull-Up so the tier-A
    // Assisted Pull-Up ranks into the slot instead.
    ...(str(answers, "pullup_ability") === "Can't do a full one yet" ? ["Pull-Up"] : []),
  ];

  const durations = (rules.slot_count_adjustment_by_duration ?? {}) as Record<string, number>;
  const filled = generateProgram(days, pool, {
    equipment: resolveEquipmentValues(
      {
        location,
        equipment_gym: arr(answers, "equipment_gym"),
        equipment_home: arr(answers, "equipment_home"),
      },
      (rules.equipment_option_map ?? {}) as Record<string, string>,
    ),
    injuries: meaningful(arr(answers, "injuries")),
    dislikes: [...new Set(excludedNames)],
    excludeMuscles: (pregRule?.exclude_muscle_groups ?? []).map((m) => m.toLowerCase()),
    requireHomeFriendly: requiresHomeFriendly(location),
    durationFactor: durations[str(answers, "session_duration") ?? ""] ?? 1,
    bodyFocus: meaningful(arr(answers, "body_focus")),
    bodyFocusRules: (rules.body_focus_boost ?? {}) as Parameters<typeof generateProgram>[2]["bodyFocusRules"],
    goal,
    trainingStyle: str(answers, "training_style"),
  });

  // ---- persist ----
  const { data: userProgram, error: programError } = await supabase
    .from("user_programs")
    .insert({
      user_id: user.id,
      training_profile_id: trainingProfile.id,
      name: split.label_en,
      split_type: splitId,
    })
    .select("id")
    .single();
  if (programError || !userProgram) return fail(programError?.message ?? "Could not create your program.");

  for (const day of filled) {
    const { data: userDay } = await supabase
      .from("user_program_days")
      .insert({
        user_program_id: userProgram.id,
        day_number: day.day_number,
        day_name: day.day_name_en,
      })
      .select("id")
      .single();
    if (!userDay || day.picks.length === 0) continue;

    await supabase.from("user_program_exercises").insert(
      // Sets/reps now vary per exercise by compound-vs-isolation role, not one
      // scheme for the whole day.
      day.picks.map((p) => ({
        user_program_day_id: userDay.id,
        exercise_id: p.exerciseId,
        order_index: p.order_index,
        sets: p.sets,
        rep_range: p.repRange,
        rest_seconds: p.restSeconds,
      })),
    );
  }

  // Surfaced rather than swallowed: a short slot means the catalog has no safe
  // exercise for that muscle given this user's equipment and injuries.
  const unfilled: UnfilledSlot[] = filled.flatMap((d) => d.unfilled);

  return ok({ programId: userProgram.id, unfilled });
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
