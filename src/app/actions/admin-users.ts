"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Admin operations on a single user's records. Same contract as admin.ts:
 * verify the caller is an admin against their own session, then write with
 * the service-role client. Never trust the client for authorization — these
 * are reachable by direct POST.
 */

export type HistorySession = {
  id: string;
  dayName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  setCount: number;
};

export type WorkoutHistorySummary = {
  userId: string;
  email: string;
  fullName: string | null;
  sessionCount: number;
  openSessionCount: number;
  setCount: number;
  completionEventCount: number;
  /** Named so the admin can see at a glance that the plan is not in scope. */
  activeProgramName: string | null;
  sessions: HistorySession[];
};

type DayJoin = { day_name: string | null } | null;
type SessionRow = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  user_program_days: DayJoin;
};

/**
 * Read-only preview of everything a reset would remove, so the admin confirms
 * against real numbers instead of an email they typed from memory.
 */
export async function lookupWorkoutHistory(
  email: string,
): Promise<ActionResult<WorkoutHistorySummary>> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) return fail("Enter an email.");

  const db = createAdminClient();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", normalized)
    .maybeSingle();
  if (profileError) return fail(profileError.message);
  if (!profile) return fail(`No account found for ${normalized}.`);

  const { data: sessionsRaw, error: sessionsError } = await db
    .from("workout_sessions")
    .select("id, started_at, completed_at, user_program_days(day_name)")
    .eq("user_id", profile.id)
    .order("started_at", { ascending: false });
  if (sessionsError) return fail(sessionsError.message);

  const rows = (sessionsRaw ?? []) as unknown as SessionRow[];
  const sessionIds = rows.map((s) => s.id);

  // One query for every set, then bucket by session — avoids N round-trips
  // for a user with a long history.
  let setsBySession = new Map<string, number>();
  let setCount = 0;
  if (sessionIds.length > 0) {
    const { data: sets, error: setsError } = await db
      .from("workout_sets")
      .select("id, session_id")
      .in("session_id", sessionIds);
    if (setsError) return fail(setsError.message);
    setCount = sets?.length ?? 0;
    setsBySession = (sets ?? []).reduce((map, s) => {
      map.set(s.session_id, (map.get(s.session_id) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
  }

  const [{ count: eventCount }, { data: program }] = await Promise.all([
    db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("event_type", "session_completed"),
    db
      .from("user_programs")
      .select("name")
      .eq("user_id", profile.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  return ok({
    userId: profile.id,
    email: profile.email ?? normalized,
    fullName: profile.full_name,
    sessionCount: rows.length,
    openSessionCount: rows.filter((s) => !s.completed_at).length,
    setCount,
    completionEventCount: eventCount ?? 0,
    activeProgramName: program?.name ?? null,
    sessions: rows.map((s) => ({
      id: s.id,
      dayName: s.user_program_days?.day_name ?? null,
      startedAt: s.started_at,
      completedAt: s.completed_at,
      setCount: setsBySession.get(s.id) ?? 0,
    })),
  });
}

export type ResetResult = {
  sessionsDeleted: number;
  setsDeleted: number;
  eventsDeleted: number;
};

/**
 * Wipes a user's logged training history — sessions, their sets, and the
 * session_completed events — and nothing else. The program (user_programs /
 * _days / _exercises), training profile, check-ins and meal logs are left
 * alone, so the user keeps their plan and simply starts logging from zero.
 *
 * Deleting the sessions also clears the weekly completion lock (018), which
 * is the point: a day finished by accident becomes trainable again.
 *
 * `confirmEmail` must match the target's address. The client already gates on
 * it; re-checking here means a stale userId from a re-used form can't resolve
 * to a different account.
 */
export async function resetWorkoutHistory(
  userId: string,
  confirmEmail: string,
): Promise<ActionResult<ResetResult>> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  const db = createAdminClient();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return fail(profileError.message);
  if (!profile) return fail("Account not found.");

  const typed = confirmEmail.trim().toLowerCase();
  if (!typed || typed !== (profile.email ?? "").trim().toLowerCase()) {
    return fail("The confirmation email doesn't match this account.");
  }

  const { data: sessions, error: sessionsError } = await db
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId);
  if (sessionsError) return fail(sessionsError.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);

  // Sets first. The FK cascades on session delete anyway, but deleting them
  // explicitly is what lets us report an accurate count back to the admin.
  let setsDeleted = 0;
  if (sessionIds.length > 0) {
    const { data: deletedSets, error: setsError } = await db
      .from("workout_sets")
      .delete()
      .in("session_id", sessionIds)
      .select("id");
    if (setsError) return fail(setsError.message);
    setsDeleted = deletedSets?.length ?? 0;
  }

  const { data: deletedSessions, error: deleteSessionsError } = await db
    .from("workout_sessions")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (deleteSessionsError) return fail(deleteSessionsError.message);

  // Every session is gone, so all of this user's completion events are now
  // orphans — including any left behind by earlier manual cleanups.
  const { data: deletedEvents, error: eventsError } = await db
    .from("events")
    .delete()
    .eq("user_id", userId)
    .eq("event_type", "session_completed")
    .select("id");
  if (eventsError) return fail(eventsError.message);

  const result: ResetResult = {
    sessionsDeleted: deletedSessions?.length ?? 0,
    setsDeleted,
    eventsDeleted: deletedEvents?.length ?? 0,
  };

  // Audit trail: survives future resets (only session_completed is cleared).
  await db.from("events").insert({
    user_id: userId,
    event_type: "workout_history_reset",
    payload: { ...result, reset_by: adminUserId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  revalidatePath("/workout/program");
  revalidatePath("/progress");
  revalidatePath("/review");
  revalidatePath("/admin/users");
  return ok(result);
}
