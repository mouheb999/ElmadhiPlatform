"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { pickBestTemplate, type TemplateCandidate } from "@/lib/algorithms/program-match";
import {
  filterSafeExercises,
  findSubstitute,
  type ExerciseRow,
  type Experience,
  type TrainingEquipment,
} from "@/lib/algorithms/exercise-substitution";

export type WorkoutAnswers = {
  goal: "lose_fat" | "build_muscle" | "get_stronger" | "general_fitness";
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: TrainingEquipment;
  experience: Experience;
  injuries: string[];
};

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

  const { data: trainingProfile, error } = await supabase
    .from("training_profiles")
    .insert({
      user_id: user.id,
      version: (previous?.version ?? 0) + 1,
      days_per_week: answers.daysPerWeek,
      session_minutes: answers.sessionMinutes,
      equipment: answers.equipment,
      experience: answers.experience,
      injuries: answers.injuries,
      goal: answers.goal,
    })
    .select("id")
    .single();
  if (error || !trainingProfile) return fail(error?.message ?? "Could not save your answers.");

  const { data: templates } = await supabase
    .from("program_templates")
    .select("id, name, split_type, days_per_week, goal, experience, equipment_required");

  const best = pickBestTemplate((templates ?? []) as TemplateCandidate[], {
    days_per_week: answers.daysPerWeek,
    goal: answers.goal,
    experience: answers.experience,
    equipment: answers.equipment,
  });

  if (!best) {
    return fail("No workout templates are available yet — an admin needs to add program templates.");
  }

  const { data: templateDays } = await supabase
    .from("template_days")
    .select("id, day_number, day_name")
    .eq("template_id", best.id)
    .order("day_number", { ascending: true });

  const { data: templateExercisesRaw } = await supabase
    .from("template_exercises")
    .select("id, template_day_id, exercise_id, order_index, sets, rep_range, rest_seconds, notes")
    .in("template_day_id", (templateDays ?? []).map((d) => d.id))
    .order("order_index", { ascending: true });

  const { data: allExercises } = await supabase
    .from("exercises")
    .select("id, primary_muscle, equipment, substitution_group, contraindicated_for, difficulty");

  const exercisePool = (allExercises ?? []) as ExerciseRow[];
  const safePool = filterSafeExercises(exercisePool, {
    injuries: answers.injuries,
    trainingEquipment: answers.equipment,
  });
  const safeIds = new Set(safePool.map((e) => e.id));

  const { data: userProgram, error: programError } = await supabase
    .from("user_programs")
    .insert({
      user_id: user.id,
      training_profile_id: trainingProfile.id,
      source_template_id: best.id,
      name: best.name,
      split_type: best.split_type,
    })
    .select("id")
    .single();
  if (programError || !userProgram) return fail(programError?.message ?? "Could not create your program.");

  for (const day of templateDays ?? []) {
    const { data: userDay } = await supabase
      .from("user_program_days")
      .insert({ user_program_id: userProgram.id, day_number: day.day_number, day_name: day.day_name })
      .select("id")
      .single();
    if (!userDay) continue;

    const dayExercises = (templateExercisesRaw ?? []).filter((te) => te.template_day_id === day.id);

    const rows = dayExercises.map((te) => {
      let exerciseId = te.exercise_id;
      let notes = te.notes;
      if (!safeIds.has(exerciseId)) {
        const original = exercisePool.find((e) => e.id === exerciseId);
        const substitute = original
          ? findSubstitute(original, exercisePool, {
              injuries: answers.injuries,
              trainingEquipment: answers.equipment,
              experience: answers.experience,
            })
          : null;
        if (substitute) {
          exerciseId = substitute.id;
          notes = notes ? `${notes} (swapped for your equipment/injuries)` : "Swapped for your equipment/injuries";
        }
      }
      return {
        user_program_day_id: userDay.id,
        exercise_id: exerciseId,
        order_index: te.order_index,
        sets: te.sets,
        rep_range: te.rep_range,
        rest_seconds: te.rest_seconds,
        notes,
      };
    });

    if (rows.length > 0) {
      await supabase.from("user_program_exercises").insert(rows);
    }
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
