"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { estimateMeal, type MealEstimate, type EstimatedItem } from "@/lib/ai/meal-estimator";
import { type MealSlot } from "@/app/actions/meal-logs";
import { type ActionResult, ok, fail } from "@/lib/action-result";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
// ~4MB of base64 ≈ 3MB image — plenty after the client-side downscale.
const MAX_IMAGE_BASE64_CHARS = 4_000_000;

export async function estimateMealAction(input: {
  description: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp";
}): Promise<ActionResult<MealEstimate>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (!input.description.trim() && !input.imageBase64) {
    return fail("Describe the meal or add a photo.");
  }
  if (input.imageBase64 && input.imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return fail("Photo is too large — please retake it.");
  }
  if (
    input.imageBase64 &&
    !["image/jpeg", "image/png", "image/webp"].includes(input.imageMediaType ?? "")
  ) {
    return fail("Unsupported image format.");
  }

  const estimate = await estimateMeal(supabase, input);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "ai_estimate_requested",
    payload: {
      has_image: !!input.imageBase64,
      simulated: estimate.simulated,
      item_count: estimate.items.length,
    },
  });

  return ok(estimate);
}

/**
 * Logs the (user-reviewed and possibly edited) AI estimate into the diary.
 * Values are the user's own declaration — same trust level as quick-logging —
 * but bounds are enforced so nonsense can't corrupt the analytics spine.
 */
export async function logEstimate(input: {
  slot: MealSlot;
  fromImage: boolean;
  items: EstimatedItem[];
}): Promise<ActionResult<{ logged: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (!MEAL_SLOTS.includes(input.slot)) return fail("Unknown meal slot.");
  const items = (input.items ?? []).filter(
    (i) =>
      Number.isFinite(i.calories) &&
      i.calories >= 0 &&
      i.calories <= 10000 &&
      Number.isFinite(i.quantityG) &&
      i.quantityG > 0,
  );
  if (items.length === 0) return fail("Nothing to log.");

  const today = new Date().toISOString().slice(0, 10);
  const entryMethod = input.fromImage ? "camera_ai" : "ai_estimate";

  const { error } = await supabase.from("meal_logs").insert(
    items.slice(0, 10).map((item) => ({
      user_id: user.id,
      log_date: today,
      meal_slot: input.slot,
      custom_name: String(item.name).slice(0, 120) || null,
      quantity_g: Math.round(item.quantityG),
      calories: Math.round(item.calories),
      protein_g: Math.max(0, Math.round(item.proteinG || 0)),
      carbs_g: Math.max(0, Math.round(item.carbsG || 0)),
      fat_g: Math.max(0, Math.round(item.fatG || 0)),
      entry_method: entryMethod,
      source_confidence: Number.isFinite(item.confidence)
        ? Math.max(0, Math.min(1, Math.round(item.confidence * 100) / 100))
        : null,
    })),
  );
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot: input.slot, entry_method: entryMethod, count: items.length },
  });

  revalidatePath("/diet/log");
  revalidatePath("/dashboard");
  return ok({ logged: items.length });
}
