"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextExpiry } from "@/lib/subscription";
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

/**
 * Mark every open request as looked at, clearing the nav badge.
 *
 * Called once the payments queue has actually rendered, rather than while it
 * renders: a write inside a Server Component's render body runs again on every
 * re-render and re-execution, and "the badge cleared itself while the page was
 * still loading" is exactly the failure that makes a badge untrustworthy.
 *
 * The badge counts *unseen*, not *open*. A request an admin has read and
 * deliberately left open must stop shouting, or the count only ever grows and
 * stops being information.
 */
export async function markPaymentsSeen(): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_requests")
    .update({ admin_seen_at: new Date().toISOString() })
    .eq("status", "pending")
    .is("admin_seen_at", null);
  if (error) return fail(error.message);

  revalidatePath("/admin");
  return ok(undefined);
}

/**
 * Answer a customer on their payment thread.
 *
 * Separate from `answerSupportTicket` only in what it revalidates and where it
 * is reachable from — the thread itself is an ordinary support ticket, and the
 * same rule holds: an admin reply is written with the service-role client
 * because `support_messages` refuses a user-authored row with sender 'admin'.
 */
export async function replyToPaymentThread(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const text = body.trim().slice(0, 2000);
  if (!text) return fail("Write an answer first.");

  const admin = createAdminClient();

  // The ticket must actually be a payment thread. Without this, the payments
  // queue would be a second, less careful door into every support ticket.
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, payment_request_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket?.payment_request_id) return fail("That isn't a payment conversation.");

  const { error } = await admin
    .from("support_messages")
    .insert({ ticket_id: ticketId, sender: "admin", body: text });
  if (error) return fail(error.message);

  const now = new Date().toISOString();
  const { error: ticketError } = await admin
    .from("support_tickets")
    .update({ status: "answered", last_message_at: now, last_admin_reply_at: now })
    .eq("id", ticketId);
  if (ticketError) return fail(ticketError.message);

  revalidatePath("/admin");
  revalidatePath("/checkout");
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
  const newExpiry = nextExpiry(profile?.plan_expires_at, months, now);

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
  const { data: rejected, error } = await admin
    .from("payment_requests")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: adminUserId,
    })
    .eq("id", requestId)
    .select("user_id")
    .maybeSingle();
  if (error) return fail(error.message);

  // Hand the account back to checkout.
  //
  // A trigger (migration 013) flips the profile to `pending` when a request is
  // created, and nothing ever flipped it back. Rejecting therefore left the
  // customer parked on "we're checking your payment" permanently: the request
  // was closed, but the profile still said pending, so checkout kept showing
  // the review screen and there was no route to try again. The one thing a
  // rejected customer needs is another attempt.
  //
  // Guarded on `active` so this can never revoke a paying account — a stale
  // rejection on someone who has since paid must not lock them out.
  if (rejected?.user_id) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ payment_status: "unpaid" })
      .eq("id", rejected.user_id)
      .neq("payment_status", "active");
    if (profileError) return fail(profileError.message);
  }

  revalidatePath("/admin");
  revalidatePath("/checkout");
  return ok(undefined);
}

/**
 * Note that a customer has been chased on WhatsApp, or clear that note.
 *
 * Called as the admin opens the WhatsApp link, so the list marks itself while
 * the job gets done rather than asking for a second click. It is a note, not a
 * guarantee of delivery — hence `clear`, for the mis-tap and for the person
 * worth chasing again later.
 */
export async function setContacted(
  userId: string,
  contacted: boolean,
): Promise<ActionResult> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(
      contacted
        ? { contacted_at: new Date().toISOString(), contacted_by: adminUserId }
        : { contacted_at: null, contacted_by: null },
    )
    .eq("id", userId);
  if (error) return fail(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");
  return ok(undefined);
}
