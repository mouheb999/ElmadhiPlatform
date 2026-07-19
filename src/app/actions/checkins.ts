"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { tunisDateKey } from "@/lib/dates";

export type CheckinInput = {
  weightKg: number | null;
  energy: number | null; // 1-5
  sleepHours: number | null;
};

/** Upserts today's morning check-in (one row per user per day). */
export async function submitCheckin(input: CheckinInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (input.weightKg === null && input.energy === null && input.sleepHours === null) {
    return fail("Nothing to save.");
  }
  if (input.weightKg !== null && (input.weightKg < 25 || input.weightKg > 350)) {
    return fail("Weight looks off — please double-check.");
  }

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      // Tunis calendar day, not UTC — a 00:30 check-in belongs to today here.
      checkin_date: tunisDateKey(),
      weight_kg: input.weightKg,
      energy: input.energy,
      sleep_hours: input.sleepHours,
    },
    { onConflict: "user_id,checkin_date" },
  );
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "checkin_submitted",
    payload: { has_weight: input.weightKg !== null },
  });

  revalidatePath("/dashboard");
  return ok(undefined);
}
