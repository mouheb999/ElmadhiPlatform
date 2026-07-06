"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeDietProposal } from "@/lib/coach/diet-proposal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Applies the pending diet adaptation. The proposal is recomputed
 * server-side from the same inputs the review page used — the client sends
 * no numbers, so there is nothing to tamper with. Writes a new versioned
 * macro_targets row (never edits in place) plus the audit row that both
 * explains the change and starts the weekly cooldown.
 */
export async function applyDietAdaptation(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const context = await computeDietProposal(supabase, user.id);
  if (!context) return fail("No adjustment is due right now.");
  const { proposal, dietProfileId, targets } = context;

  const { error: targetsError } = await supabase.from("macro_targets").insert({
    diet_profile_id: dietProfileId,
    bmr: targets.bmr,
    tdee: targets.tdee,
    calories: proposal.newCalories,
    protein_g: proposal.newProteinG,
    carbs_g: proposal.newCarbsG,
    fat_g: proposal.newFatG,
    fiber_g: targets.fiberG,
    rationale_json: {
      adapted: true,
      reason_key: proposal.reasonKey,
      trend_kg: proposal.trendKg,
      old_calories: proposal.oldCalories,
      delta_kcal: proposal.deltaKcal,
    },
  });
  if (targetsError) return fail(targetsError.message);

  const { error: auditError } = await supabase.from("plan_adaptations").insert({
    user_id: user.id,
    kind: "diet",
    reason_key: proposal.reasonKey,
    payload: {
      old_calories: proposal.oldCalories,
      new_calories: proposal.newCalories,
      delta_kcal: proposal.deltaKcal,
      trend_kg: proposal.trendKg,
      new_protein_g: proposal.newProteinG,
      new_carbs_g: proposal.newCarbsG,
      new_fat_g: proposal.newFatG,
    },
  });
  if (auditError) return fail(auditError.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "plan_adapted",
    payload: { kind: "diet", reason_key: proposal.reasonKey, delta_kcal: proposal.deltaKcal },
  });

  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/diet/plan");
  revalidatePath("/diet/log");
  return ok(undefined);
}
