"use server";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Records a manual payment request: the user picked a plan + method and
 * clicked "I've paid". We log a pending payment_request; a DB trigger
 * (migration 013) flips the profile to `pending` so the checkout page shows
 * the "under review" state. Users have no UPDATE grant on payment columns,
 * so the flip cannot happen from the client. An admin later confirms the
 * WhatsApp screenshot and activates the subscription.
 *
 * Price, tier, and duration are read server-side from the chosen plan —
 * the client sends only the plan id, so amounts can't be tampered with.
 */
export async function createPaymentRequest(
  methodKey: string,
  planId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("tier, months, price_tnd")
    .eq("id", planId)
    .eq("is_enabled", true)
    .maybeSingle();
  if (!plan) return fail("Plan not found.");

  const { error: insertError } = await supabase.from("payment_requests").insert({
    user_id: user.id,
    method_key: methodKey,
    amount_tnd: plan.price_tnd,
    plan_tier: plan.tier,
    plan_months: plan.months,
  });
  if (insertError) return fail(insertError.message);

  return ok(undefined);
}
