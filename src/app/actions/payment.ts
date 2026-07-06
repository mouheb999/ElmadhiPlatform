"use server";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Records a manual payment request: the user picked a method and clicked
 * "I've paid". We log a pending payment_request; a DB trigger (migration 013)
 * flips the profile to `pending` so the checkout page shows the "under
 * review" state. Users have no UPDATE grant on payment columns, so the flip
 * cannot happen from the client. An admin later confirms the WhatsApp
 * screenshot and activates the account.
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

  return ok(undefined);
}
