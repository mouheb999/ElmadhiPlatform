"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { tunisWeekStartUtc } from "@/lib/dates";
import { SESSION_ERR } from "@/lib/session-codes";

const PG_UNIQUE_VIOLATION = "23505";

// ============================================================================
// Live-session flow (018): a session row exists WHILE training
// (completed_at IS NULL), sets are saved one-by-one and are irreversible,
// and a finished day locks for the rest of the Tunis week.
// ============================================================================

export type StartSessionOk = {
  sessionId: string;
  startedAt: string;
  /** True when an already-open session for this day was picked up. */
  resumed: boolean;
};

/**
 * Opens (or resumes) the user's live session for a program day.
 * Called lazily by the client outbox on the first irreversible action —
 * merely visiting the session page never creates a row.
 */
export async function startSession(
  userProgramDayId: string,
): Promise<ActionResult<StartSessionOk>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  // Day must belong to one of the user's programs.
  const { data: day } = await supabase
    .from("user_program_days")
    .select("id, user_programs!inner(user_id)")
    .eq("id", userProgramDayId)
    .eq("user_programs.user_id", user.id)
    .maybeSingle();
  if (!day) return fail("Program day not found.");

  // Weekly gate: a day completed this Tunis week cannot be restarted.
  const { data: doneThisWeek } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("user_program_day_id", userProgramDayId)
    .not("completed_at", "is", null)
    .gte("completed_at", tunisWeekStartUtc().toISOString())
    .limit(1)
    .maybeSingle();
  if (doneThisWeek) return fail(SESSION_ERR.weekLocked);

  // At most one open session per user (partial unique index backstops races).
  const findOpen = () =>
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id, started_at")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .maybeSingle();

  const { data: open } = await findOpen();
  if (open) {
    if (open.user_program_day_id !== userProgramDayId) {
      return fail(SESSION_ERR.otherInProgress);
    }
    return ok({
      sessionId: open.id,
      startedAt: open.started_at ?? new Date().toISOString(),
      resumed: true,
    });
  }

  const { data: created, error: insertError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      user_program_day_id: userProgramDayId,
      started_at: new Date().toISOString(),
      completed_at: null,
    })
    .select("id, started_at")
    .single();

  if (insertError) {
    // Race: another tab/device opened a session between our select and insert.
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      const { data: raced } = await findOpen();
      if (raced) {
        if (raced.user_program_day_id !== userProgramDayId) {
          return fail(SESSION_ERR.otherInProgress);
        }
        return ok({
          sessionId: raced.id,
          startedAt: raced.started_at ?? new Date().toISOString(),
          resumed: true,
        });
      }
    }
    return fail(insertError.message);
  }

  return ok({
    sessionId: created.id,
    startedAt: created.started_at ?? new Date().toISOString(),
    resumed: false,
  });
}

export type LogSetInput = {
  sessionId: string;
  exerciseId: string;
  userProgramExerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number;
  rir: number | null;
};

/** The user's open session, or null. Shared ownership guard for the hot path. */
async function getOpenSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
) {
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, user_program_day_id, started_at, skipped_exercise_ids")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .maybeSingle();
  return data;
}

/**
 * Persists one completed set. Idempotent: replaying the same
 * (session, plan row, set number) — outbox retry, cross-device double tap —
 * returns the already-stored set instead of erroring. Deliberately no
 * revalidatePath: this runs after every set, mid-workout.
 */
export async function logSet(input: LogSetInput): Promise<ActionResult<{ setId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (!Number.isInteger(input.reps) || input.reps < 1 || input.reps > 100) {
    return fail("Reps look off — please double-check.");
  }
  if (input.weightKg !== null && (input.weightKg < 0 || input.weightKg > 500)) {
    return fail("Weight looks off — please double-check.");
  }
  if (input.rir !== null && (!Number.isInteger(input.rir) || input.rir < 0 || input.rir > 10)) {
    return fail("RIR must be between 0 and 10.");
  }
  if (!Number.isInteger(input.setNumber) || input.setNumber < 1 || input.setNumber > 30) {
    return fail("Set number looks off.");
  }

  const session = await getOpenSession(supabase, user.id, input.sessionId);
  if (!session) return fail(SESSION_ERR.notOpen);

  const { data: created, error: insertError } = await supabase
    .from("workout_sets")
    .insert({
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      user_program_exercise_id: input.userProgramExerciseId,
      set_number: input.setNumber,
      weight_kg: input.weightKg,
      reps: input.reps,
      rir: input.rir,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      const { data: existing } = await supabase
        .from("workout_sets")
        .select("id")
        .eq("session_id", input.sessionId)
        .eq("user_program_exercise_id", input.userProgramExerciseId)
        .eq("set_number", input.setNumber)
        .maybeSingle();
      if (existing) return ok({ setId: existing.id });
    }
    return fail(insertError.message);
  }

  return ok({ setId: created.id });
}

/** Marks an exercise as skipped for the open session. Locked once stored. */
export async function skipExercise(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const session = await getOpenSession(supabase, user.id, sessionId);
  if (!session) return fail(SESSION_ERR.notOpen);

  const skipped: string[] = session.skipped_exercise_ids ?? [];
  if (skipped.includes(exerciseId)) return ok(undefined); // idempotent replay

  const { error } = await supabase
    .from("workout_sessions")
    .update({ skipped_exercise_ids: [...skipped, exerciseId] })
    .eq("id", sessionId)
    .is("completed_at", null);
  if (error) return fail(error.message);

  return ok(undefined);
}

export type FinishSummary = { setCount: number; volumeKg: number; minutes: number };

/**
 * Closes the open session. Summary (volume, set count, duration) is computed
 * server-side from the stored sets — the client can't inflate it. Idempotent:
 * finishing an already-finished session returns its recomputed summary.
 */
export async function finishSession(input: {
  sessionId: string;
  notes: string | null;
  /** Exercise ids where the client detected a new max vs server history. */
  prExerciseIds: string[];
}): Promise<ActionResult<FinishSummary>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, user_program_day_id, started_at, completed_at, skipped_exercise_ids")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return fail("Session not found.");

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight_kg, reps")
    .eq("session_id", session.id);
  const setCount = (sets ?? []).length;
  const volumeKg = Math.round(
    (sets ?? []).reduce((sum, s) => sum + (s.weight_kg ?? 0) * s.reps, 0),
  );

  const summarize = (completedAtIso: string): FinishSummary => ({
    setCount,
    volumeKg,
    minutes: Math.max(
      1,
      Math.round(
        (Date.parse(completedAtIso) - Date.parse(session.started_at ?? completedAtIso)) / 60000,
      ),
    ),
  });

  // Double-finish (second device, retry after timeout): already closed → ok.
  if (session.completed_at) return ok(summarize(session.completed_at));

  if (setCount === 0 && (session.skipped_exercise_ids ?? []).length === 0) {
    return fail("Nothing to save yet — log at least one set.");
  }

  const completedAt = new Date().toISOString();
  const { data: closed, error: updateError } = await supabase
    .from("workout_sessions")
    .update({ completed_at: completedAt, notes: input.notes?.trim() || null })
    .eq("id", session.id)
    .is("completed_at", null)
    .select("id");

  if (updateError) {
    // Weekly unique index: same day already completed this week elsewhere.
    if (updateError.code === PG_UNIQUE_VIOLATION) return fail(SESSION_ERR.weekLocked);
    return fail(updateError.message);
  }
  if (!closed || closed.length === 0) {
    // Raced with another finish — treat as success.
    return ok(summarize(new Date().toISOString()));
  }

  // Analytics spine: best-effort, never blocks the user's save.
  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "session_completed",
    payload: {
      session_id: session.id,
      user_program_day_id: session.user_program_day_id,
      set_count: setCount,
      volume_kg: volumeKg,
      skipped_count: (session.skipped_exercise_ids ?? []).length,
      pr_exercise_ids: input.prExerciseIds,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  revalidatePath("/workout/program");
  revalidatePath("/progress");
  return ok(summarize(completedAt));
}

/**
 * Deletes an open session that has no sets and no skips (the DB trigger
 * blocks anything else). Lets the user abandon an accidental start from the
 * "workout in progress elsewhere" screen.
 */
export async function discardEmptySession(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const session = await getOpenSession(supabase, user.id, sessionId);
  if (!session) return fail(SESSION_ERR.notOpen);
  if ((session.skipped_exercise_ids ?? []).length > 0) {
    return fail("This session already has progress — finish it instead.");
  }

  const { count } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if ((count ?? 0) > 0) {
    return fail("This session already has progress — finish it instead.");
  }

  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .is("completed_at", null);
  if (error) return fail(error.message);

  revalidatePath("/workout");
  revalidatePath("/workout/program");
  revalidatePath("/dashboard");
  return ok(undefined);
}
