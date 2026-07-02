"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import {
  PRIMARY_MUSCLES,
  EQUIPMENT,
  type ExerciseInput,
} from "./exercises-meta";

/**
 * Exercises content management (admin only). Every action verifies the caller
 * is an admin via the user-session client, then writes with the service-role
 * client. `search_vector` is maintained by a DB trigger, so we never set it.
 *
 * Enums + the input type live in `exercises-meta.ts` — a `"use server"` module
 * may only export async functions.
 */

function validate(input: ExerciseInput): string | null {
  if (!input.name_en.trim() && !input.name_ar.trim())
    return "A name is required.";
  if (
    !PRIMARY_MUSCLES.includes(
      input.primary_muscle as (typeof PRIMARY_MUSCLES)[number],
    )
  )
    return "Invalid primary muscle.";
  if (!EQUIPMENT.includes(input.equipment as (typeof EQUIPMENT)[number]))
    return "Invalid equipment.";
  return null;
}

function toRow(input: ExerciseInput) {
  return {
    name_ar: input.name_ar.trim() || null,
    name_en: input.name_en.trim(),
    primary_muscle: input.primary_muscle,
    secondary_muscles: input.secondary_muscles,
    equipment: input.equipment,
    movement_pattern: input.movement_pattern,
    difficulty: input.difficulty,
    contraindicated_for: input.contraindicated_for,
    video_url: input.video_url,
    thumbnail_url: input.thumbnail_url,
    instructions: input.instructions,
  };
}

export async function createExercise(
  input: ExerciseInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const admin = createAdminClient();
  const { error } = await admin.from("exercises").insert(toRow(input));
  if (error) return fail(error.message);

  revalidatePath("/admin/exercises");
  return ok(undefined);
}

export async function updateExercise(
  id: string,
  input: ExerciseInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const admin = createAdminClient();
  const { error } = await admin
    .from("exercises")
    .update(toRow(input))
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/exercises");
  return ok(undefined);
}

export async function deleteExercise(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("exercises").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/exercises");
  return ok(undefined);
}
