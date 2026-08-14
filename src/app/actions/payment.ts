"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { type ActionResult, ok, fail } from "@/lib/action-result";

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Records a manual payment request: the user picked a plan + method and said
 * they have transferred the money. We log a pending payment_request; a DB
 * trigger (migration 013) flips the profile to `pending` so checkout shows the
 * "under review" state. Users have no UPDATE grant on payment columns, so that
 * flip cannot happen from the client. An admin confirms and activates.
 *
 * Price, tier and duration are read server-side from the chosen plan — the
 * client sends only the plan id, so amounts cannot be tampered with.
 *
 * Re-running this updates the row in place rather than inserting a second one.
 * Somebody who picks the 3-month plan, backs out and picks the 6-month plan is
 * doing something completely ordinary, and it used to leave two pending rows an
 * admin could activate separately — charging one term and granting two.
 * Migration 041 makes one-pending-per-user an invariant; this keeps the flow
 * from tripping over it.
 */
export async function startPaymentRequest(
  methodKey: string,
  planId: string,
): Promise<ActionResult<{ requestId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("tier, months, price_tnd")
    .eq("id", planId)
    .eq("is_enabled", true)
    .maybeSingle();
  if (!plan) return fail("Plan not found.");

  const { data: existing } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("payment_requests")
      .update({
        method_key: methodKey,
        amount_tnd: plan.price_tnd,
        plan_tier: plan.tier,
        plan_months: plan.months,
      })
      .eq("id", existing.id);
    if (error) return fail(error.message);
    revalidatePath("/checkout");
    return ok({ requestId: existing.id });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("payment_requests")
    .insert({
      user_id: user.id,
      method_key: methodKey,
      amount_tnd: plan.price_tnd,
      plan_tier: plan.tier,
      plan_months: plan.months,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  revalidatePath("/checkout");
  return ok({ requestId: inserted.id });
}

/**
 * Attaches the transfer screenshot to the caller's open request.
 *
 * This is the step that replaces the WhatsApp handoff. Confirming a manual
 * transfer has always meant an admin looking at a screenshot; the only thing
 * that changes is that the screenshot now arrives attached to the row it
 * belongs to instead of in a separate chat an admin had to match up by hand.
 *
 * Writes with the service-role client because the `payment-proofs` bucket
 * grants nothing to `authenticated` (migration 041) — payment screenshots show
 * account numbers and balances, so the bucket is private and unreachable with a
 * user's own token. The path is namespaced by user id, and the request row is
 * matched on `user_id` too, so a caller can only ever attach to their own.
 */
export async function attachPaymentProof(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const file = formData.get("file");
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 500) : null;

  if (!(file instanceof File) || file.size === 0) return fail("No file provided.");
  if (!file.type.startsWith("image/")) return fail("File must be an image.");
  if (file.size > MAX_PROOF_BYTES) return fail("Image must be under 5 MB.");

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) return fail("No payment in progress.");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail(uploadError.message);

  const { error: updateError } = await admin
    .from("payment_requests")
    .update({
      proof_path: path,
      proof_note: note,
      proof_uploaded_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("user_id", user.id);
  if (updateError) return fail(updateError.message);

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}
