"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export type SessionSetInput = {
  exerciseId: string;
  userProgramExerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number;
  rir: number | null;
};

export type CompleteSessionInput = {
  userProgramDayId: string;
  startedAt: string; // ISO — client-side, sessions are drafted offline
  notes: string | null;
  skippedExerciseIds: string[];
  sets: SessionSetInput[];
  /** Exercise ids where the client detected a new max weight (vs. server-provided history). */
  prExerciseIds: string[];
};

/**
 * Persists a finished workout session in one write. The session is drafted
 * locally (localStorage) so flaky gym connectivity can't lose sets; this is
 * the single sync point at the end.
 */
export async function completeSession(
  input: CompleteSessionInput,
): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const performedSets = input.sets.filter((s) => s.reps > 0);
  if (performedSets.length === 0 && input.skippedExerciseIds.length === 0) {
    return fail("Nothing to save yet — log at least one set.");
  }

  // Ownership check: the day must belong to one of the user's programs.
  // (RLS would also block the insert reference, but fail early and clearly.)
  const { data: day } = await supabase
    .from("user_program_days")
    .select("id, user_programs!inner(user_id)")
    .eq("id", input.userProgramDayId)
    .eq("user_programs.user_id", user.id)
    .maybeSingle();
  if (!day) return fail("Program day not found.");

  const startedAt = Number.isNaN(Date.parse(input.startedAt))
    ? new Date().toISOString()
    : input.startedAt;

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      user_program_day_id: input.userProgramDayId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      notes: input.notes?.trim() || null,
      skipped_exercise_ids: input.skippedExerciseIds,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    return fail(sessionError?.message ?? "Could not save session.");
  }

  if (performedSets.length > 0) {
    const { error: setsError } = await supabase.from("workout_sets").insert(
      performedSets.map((s) => ({
        session_id: session.id,
        exercise_id: s.exerciseId,
        user_program_exercise_id: s.userProgramExerciseId,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      })),
    );
    if (setsError) {
      // Roll back the header so a retry doesn't leave a phantom empty session.
      await supabase.from("workout_sessions").delete().eq("id", session.id);
      return fail(setsError.message);
    }
  }

  const volumeKg = performedSets.reduce(
    (sum, s) => sum + (s.weightKg ?? 0) * s.reps,
    0,
  );

  // Analytics spine: best-effort, never blocks the user's save.
  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "session_completed",
    payload: {
      session_id: session.id,
      user_program_day_id: input.userProgramDayId,
      set_count: performedSets.length,
      volume_kg: Math.round(volumeKg),
      skipped_count: input.skippedExerciseIds.length,
      pr_exercise_ids: input.prExerciseIds,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  return ok({ sessionId: session.id });
}
