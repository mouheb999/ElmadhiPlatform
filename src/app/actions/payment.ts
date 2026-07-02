"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Records a manual payment request: the user picked a method and clicked
 * "I've paid". We log a pending payment_request and flip the profile to
 * `pending` so the checkout page shows the "under review" state. An admin
 * later confirms the WhatsApp screenshot and activates the account.
 */
export async function createPaymentRequest(
  methodKey: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  // Pull the current price from settings so the logged amount is authoritative.
  const { data: settings } = await supabase
    .from("payment_settings")
    .select("price_tnd")
    .eq("id", 1)
    .maybeSingle();

  const amount = settings?.price_tnd ?? 89;

  const { error: insertError } = await supabase.from("payment_requests").insert({
    user_id: user.id,
    method_key: methodKey,
    amount_tnd: amount,
  });
  if (insertError) return fail(insertError.message);

  // Don't downgrade an already-active account back to pending.
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.payment_status !== "active") {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ payment_status: "pending" })
      .eq("id", user.id);
    if (updateError) return fail(updateError.message);
  }

  return ok(undefined);
}

/**
 * Legacy one-click unlock kept for local testing only. Flips has_paid +
 * payment_status so protected routes open without the manual flow.
 * TODO(mouheb): remove before launch.
 */
export async function markPaid(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { error } = await supabase
    .from("profiles")
    .update({ has_paid: true, payment_status: "active" })
    .eq("id", user.id);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function markPaidAndContinue(): Promise<void> {
  const result = await markPaid();
  if (!result.ok) return;
  redirect("/dashboard");
}
