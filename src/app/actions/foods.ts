"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { FOOD_CATEGORIES, type FoodInput } from "./foods-meta";

/**
 * Foods content management (admin only). Every action verifies the caller is an
 * admin via the user-session client, then writes with the service-role client.
 * `search_vector` is maintained by a DB trigger, so we never set it here.
 *
 * Enums + the input type live in `foods-meta.ts` — a `"use server"` module may
 * only export async functions.
 */

function validate(input: FoodInput): string | null {
  if (!input.name_ar.trim() && !input.name_en.trim())
    return "A name is required.";
  if (!FOOD_CATEGORIES.includes(input.category as (typeof FOOD_CATEGORIES)[number]))
    return "Invalid category.";
  const numbers = [
    input.calories_per_100g,
    input.protein_per_100g,
    input.carbs_per_100g,
    input.fat_per_100g,
    input.fiber_per_100g,
  ];
  if (numbers.some((n) => !Number.isFinite(n) || n < 0))
    return "Macros must be zero or positive numbers.";
  return null;
}

function toRow(input: FoodInput) {
  return {
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim() || null,
    category: input.category,
    calories_per_100g: input.calories_per_100g,
    protein_per_100g: input.protein_per_100g,
    carbs_per_100g: input.carbs_per_100g,
    fat_per_100g: input.fat_per_100g,
    fiber_per_100g: input.fiber_per_100g,
    typical_serving_g: input.typical_serving_g,
    price_tnd_per_kg: input.price_tnd_per_kg,
    price_tier: input.price_tier,
    allergens: input.allergens,
    tags: input.tags,
    is_common: input.is_common,
    image_url: input.image_url,
  };
}

export async function createFood(input: FoodInput): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const admin = createAdminClient();
  const { error } = await admin.from("foods").insert(toRow(input));
  if (error) return fail(error.message);

  revalidatePath("/admin/foods");
  return ok(undefined);
}

export async function updateFood(
  id: string,
  input: FoodInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const admin = createAdminClient();
  const { error } = await admin.from("foods").update(toRow(input)).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/foods");
  return ok(undefined);
}

export async function deleteFood(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("foods").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/foods");
  return ok(undefined);
}
