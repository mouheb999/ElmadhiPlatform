"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Admin mutations. Every action verifies the caller is an admin via the
 * user-session client (getAdminUser), then performs the write with the
 * service-role client (bypasses RLS). Never trust input for authorization.
 */

export type SettingsInput = {
  price_tnd: number;
  compare_at_tnd: number | null;
  offer_label_en: string;
  offer_label_ar: string;
  whatsapp_number: string;
  whatsapp_message_en: string;
  whatsapp_message_ar: string;
};

export async function updatePaymentSettings(
  input: SettingsInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_settings")
    .update({
      price_tnd: input.price_tnd,
      compare_at_tnd: input.compare_at_tnd,
      offer_label_en: input.offer_label_en,
      offer_label_ar: input.offer_label_ar,
      whatsapp_number: input.whatsapp_number,
      whatsapp_message_en: input.whatsapp_message_en,
      whatsapp_message_ar: input.whatsapp_message_ar,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail(error.message);

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}

export type MethodInput = {
  id: string;
  is_enabled: boolean;
  label_en: string;
  label_ar: string;
  account_value: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
};

export async function updatePaymentMethod(
  input: MethodInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_methods")
    .update({
      is_enabled: input.is_enabled,
      label_en: input.label_en,
      label_ar: input.label_ar,
      account_value: input.account_value,
      instructions_en: input.instructions_en,
      instructions_ar: input.instructions_ar,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return fail(error.message);

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}

/** Confirm a request and activate the user's account. */
export async function activateRequest(requestId: string): Promise<ActionResult> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();

  const { data: req, error: reqError } = await admin
    .from("payment_requests")
    .select("id, user_id, status, plan_tier, plan_months")
    .eq("id", requestId)
    .maybeSingle();
  if (reqError) return fail(reqError.message);
  if (!req) return fail("Request not found.");

  const { error: updateReqError } = await admin
    .from("payment_requests")
    .update({
      status: "confirmed",
      resolved_at: new Date().toISOString(),
      resolved_by: adminUserId,
    })
    .eq("id", requestId);
  if (updateReqError) return fail(updateReqError.message);

  // Subscription math: a renewal extends the current expiry, a lapsed or
  // first-time subscription starts from now. Legacy requests without a plan
  // default to 1 month of premium.
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", req.user_id)
    .maybeSingle();

  const months = req.plan_months ?? 1;
  const tier = req.plan_tier === "standard" ? "standard" : "premium";
  const now = new Date();
  const currentExpiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(base);
  newExpiry.setMonth(newExpiry.getMonth() + months);

  const { error: updateProfileError } = await admin
    .from("profiles")
    .update({
      payment_status: "active",
      has_paid: true,
      paid_at: now.toISOString(),
      plan_type: tier,
      plan_expires_at: newExpiry.toISOString(),
    })
    .eq("id", req.user_id);
  if (updateProfileError) return fail(updateProfileError.message);

  revalidatePath("/admin");
  return ok(undefined);
}

/** Admin: adjust a subscription plan's price. */
export async function updatePlanPrice(
  planId: string,
  priceTnd: number,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  if (!Number.isFinite(priceTnd) || priceTnd <= 0 || priceTnd > 10000) {
    return fail("Price looks off.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("subscription_plans")
    .update({ price_tnd: priceTnd, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) return fail(error.message);

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}

/** Reject a request. Leaves the account unpaid. */
export async function rejectRequest(requestId: string): Promise<ActionResult> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_requests")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: adminUserId,
    })
    .eq("id", requestId);
  if (error) return fail(error.message);

  revalidatePath("/admin");
  return ok(undefined);
}
