"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePaidUser, requirePlanUser } from "@/lib/subscription-server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import {
  DEFAULT_CARDIO_SLUG,
  caloriesBurned,
  isValidCardioMinutes,
} from "@/lib/algorithms/cardio";
import { SESSION_ERR } from "@/lib/session-codes";

/**
 * Cardio, kept at arm's length from both of the things it must not disturb.
 *
 * It never writes `user_program_exercises` (that would change the workout) and
 * it never writes `macro_targets` or touches a meal plan (that would change the
 * food). Both rules are from the cardio sheet; see lib/algorithms/cardio.ts.
 *
 * Shaping the program is free everywhere else in this codebase, so ATTACHING
 * cardio is `requirePlanUser` like every other plan edit. RECORDING a session
 * is the paid half, so `logCardio` is `requirePaidUser`, matching sessions.ts.
 */

/** The day must belong to one of the caller's programs. Returns its id or null. */
async function ownedDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dayId: string,
) {
  const { data } = await supabase
    .from("user_program_days")
    .select("id, day_name, user_programs!inner(user_id)")
    .eq("id", dayId)
    .eq("user_programs.user_id", userId)
    .maybeSingle();
  return data;
}

export type AttachedCardio = {
  id: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string | null;
  minutes: number;
};

/**
 * Attach (or re-time) the cardio block on a program day. One block per day —
 * the unique constraint on `user_program_day_id` is what makes this an upsert
 * rather than an insert, so tapping "add" twice cannot stack two walks.
 */
export async function setDayCardio(
  dayId: string,
  minutes: number,
): Promise<ActionResult<AttachedCardio>> {
  const { user, denied } = await requirePlanUser();
  if (!user) return fail(denied);
  if (!isValidCardioMinutes(minutes)) return fail("Pick between 5 and 120 minutes.");

  const supabase = await createClient();
  const day = await ownedDay(supabase, user.id, dayId);
  if (!day) return fail("That training day isn't in your program.");

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name_en, name_ar")
    .eq("slug", DEFAULT_CARDIO_SLUG)
    .maybeSingle();
  if (!exercise) return fail("Speed Walking isn't in the catalog — apply migration 051 first.");

  const { data, error } = await supabase
    .from("user_program_cardio")
    .upsert(
      { user_program_day_id: dayId, exercise_id: exercise.id, minutes },
      { onConflict: "user_program_day_id" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Could not add cardio.");

  revalidatePath("/workout");
  return ok({
    id: data.id,
    exerciseId: exercise.id,
    nameEn: exercise.name_en,
    nameAr: exercise.name_ar,
    minutes,
  });
}

/** Take the cardio block off a day. */
export async function removeDayCardio(dayId: string): Promise<ActionResult> {
  const { user, denied } = await requirePlanUser();
  if (!user) return fail(denied);

  const supabase = await createClient();
  const day = await ownedDay(supabase, user.id, dayId);
  if (!day) return fail("That training day isn't in your program.");

  const { error } = await supabase
    .from("user_program_cardio")
    .delete()
    .eq("user_program_day_id", dayId);
  if (error) return fail(error.message);

  revalidatePath("/workout");
  return ok(undefined);
}

export type LoggedCardio = { minutes: number; caloriesBurned: number };

/**
 * Record the cardio actually done in an open session.
 *
 * The burn is computed HERE, from the catalog's MET value and the user's own
 * most recent weigh-in — never from a number the client posts, for the same
 * reason `logFood` re-reads macros from the catalog. Idempotent: the unique
 * constraint on `session_id` means a retry from the outbox updates the one row
 * instead of stacking a second walk onto the session.
 *
 * What it deliberately does NOT do: touch the meal plan, the macro targets, or
 * anything else the nutrition side reads. The sheet is explicit — burned
 * calories are not eaten back.
 */
export async function logCardio(
  sessionId: string,
  minutes: number,
): Promise<ActionResult<LoggedCardio>> {
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);
  if (!isValidCardioMinutes(minutes)) return fail("Pick between 5 and 120 minutes.");

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .maybeSingle();
  if (!session) return fail(SESSION_ERR.notOpen);

  const [{ data: exercise }, { data: checkin }, { data: profile }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, met_value")
      .eq("slug", DEFAULT_CARDIO_SLUG)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("weight_kg")
      .eq("user_id", user.id)
      .not("weight_kg", "is", null)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Falls back to the weight the diet profile was built on, then to a
    // neutral 75 kg. The estimate is coarse either way; what matters is that
    // it is never taken from the client.
    supabase
      .from("diet_profiles")
      .select("weight_kg")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (!exercise) return fail("Speed Walking isn't in the catalog — apply migration 051 first.");

  const weightKg = checkin?.weight_kg ?? profile?.weight_kg ?? 75;
  const burned = caloriesBurned({
    metValue: exercise.met_value ?? 4.8,
    weightKg,
    minutes,
  });

  const { error } = await supabase.from("workout_cardio_logs").upsert(
    {
      session_id: sessionId,
      exercise_id: exercise.id,
      minutes,
      calories_burned: burned,
    },
    { onConflict: "session_id" },
  );
  if (error) return fail(error.message);

  return ok({ minutes, caloriesBurned: burned });
}
