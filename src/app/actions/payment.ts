"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { notifyTelegram } from "@/lib/notify/telegram";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { isSubscriptionActive } from "@/lib/subscription";

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * The formats a phone camera or a banking app actually produces. Deliberately
 * an allow-list rather than `image/*`: that accepted SVG, which is a script
 * container, and these files are rendered in an admin's browser from a signed
 * URL on our own storage origin.
 */
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Ceiling on one payment conversation. See `sendPaymentMessage`. */
const MAX_THREAD_MESSAGES = 50;

/** Ceiling on payment threads per account. See `suggestPaymentMethod`. */
const MAX_PAYMENT_TICKETS = 3;

/** Marks a suggestion in the support queue so an admin can see what it is. */
const SUGGESTION_PREFIX = "[payment method]";

/** Extension written into the storage path, chosen by us from the MIME type. */
const EXTENSION_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Who the admin is looking at, for the notification. */
async function notifyContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ name: string | null; email: string | null; phone: string | null }> {
  const { data } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();
  return {
    name: data?.full_name ?? null,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
  };
}

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
    // Written with the service-role client, and this is not an oversight.
    //
    // `payment_requests` has RLS policies for INSERT and SELECT and none for
    // UPDATE, so this statement through the user's own session matched zero
    // rows — and PostgREST reports a zero-row UPDATE as success, not as an
    // error. The whole re-selection path therefore returned `ok` while quietly
    // keeping the plan the customer first chose: pick 1 month, back out, pick
    // 6 months, tap "I've transferred" — and the admin queue still says one
    // month at one month's price. Somebody pays for six and is granted one.
    //
    // The fix is not an RLS UPDATE policy. That would let a caller PATCH their
    // own row over PostgREST and set `amount_tnd` to 1 and `plan_months` to 12,
    // which is the tampering the server-side price lookup above exists to
    // prevent. So the write bypasses RLS, and stays scoped to a row this user
    // owns and has not had resolved yet.
    const { data: updated, error } = await createAdminClient()
      .from("payment_requests")
      .update({
        method_key: methodKey,
        amount_tnd: plan.price_tnd,
        plan_tier: plan.tier,
        plan_months: plan.months,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    // Nothing matched: the request was confirmed or rejected between the read
    // above and this write. Falling through to the insert would be wrong (an
    // activated account does not need a second request), and reporting success
    // would repeat the bug this replaced.
    if (!updated) return fail("That payment request is no longer open.");
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

  // Ping before the receipt exists, because this is already actionable: it is
  // somebody who says they have transferred money. If they then close the app
  // without uploading anything — the case the old flow lost entirely — there is
  // now a name and a number to chase.
  const admin = createAdminClient();
  await notifyTelegram({
    kind: "payment_started",
    ...(await notifyContext(admin, user.id)),
    amountTnd: plan.price_tnd,
    planTier: plan.tier,
    planMonths: plan.months,
    methodKey,
  });

  revalidatePath("/checkout");
  revalidatePath("/admin");
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
  // An allow-list, not `image/*`. That prefix check accepted `image/svg+xml`,
  // which is a document that can carry script — and these files are rendered
  // for an admin from a signed URL on our own storage origin, so a stored SVG
  // is a script the admin's session would run.
  if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
    return fail("Send a photo or screenshot (JPG, PNG or WebP).");
  }
  if (file.size > MAX_PROOF_BYTES) return fail("Image must be under 5 MB.");

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("payment_requests")
    .select("id, amount_tnd, proof_path")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) return fail("No payment in progress.");

  // Replacing a receipt is a real thing to do — the first screenshot was
  // cropped, or of the wrong transfer. Uploading unboundedly is not: each one
  // is 5 MB of private storage that nothing ever reclaimed, and each one pinged
  // an admin. The previous object is removed once the new one is in place.
  const previousPath = request.proof_path;

  // Extension derived from the (validated) MIME type rather than the uploaded
  // filename. The old version sanitised whatever the client sent, which still
  // let the caller choose what the object is stored as.
  const ext = EXTENSION_FOR_TYPE[file.type] ?? "jpg";
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

  // Only after the row points at the new object, so a failure here leaves a
  // stray file rather than a request whose receipt has been deleted.
  if (previousPath && previousPath !== path) {
    const { error: removeError } = await admin.storage
      .from("payment-proofs")
      .remove([previousPath]);
    if (removeError) console.error("[payment] stale proof not removed:", removeError);
  }

  // The receipt opens a conversation. Until now this step ended in a screen
  // that said "we're checking" and offered no way to say anything else — so a
  // transfer we couldn't match, or an amount that was short, had no route back
  // to the customer except the WhatsApp link the rest of this flow spent two
  // migrations demoting.
  await openPaymentThread(admin, user.id, request.id, note);

  await notifyTelegram({
    kind: "proof_uploaded",
    ...(await notifyContext(admin, user.id)),
    amountTnd: request.amount_tnd,
    note,
  });

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}

/**
 * Open (or reuse) the support thread attached to a payment request.
 *
 * A payment conversation is a support ticket in category 'payment' that knows
 * which request it is about — see migration 044 for why that beat a second
 * messaging system. Written with the service-role client because the opening
 * message is ours, not the user's, and `support_messages` deliberately refuses
 * a user-authored row with `sender = 'admin'`.
 *
 * Best-effort: a failure here must not fail an upload that already succeeded.
 * The receipt is attached and the admin queue has it either way.
 */
async function openPaymentThread(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string,
  note: string | null,
): Promise<void> {
  try {
    const { data: existing } = await admin
      .from("support_tickets")
      .select("id")
      .eq("payment_request_id", requestId)
      .maybeSingle();
    if (existing) {
      // Re-uploading a receipt on the same request reopens the thread rather
      // than starting a second one, so the history stays in one place.
      await admin
        .from("support_tickets")
        .update({ status: "open", last_message_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (note) {
        await admin
          .from("support_messages")
          .insert({ ticket_id: existing.id, sender: "user", body: note });
      }
      return;
    }

    const now = new Date().toISOString();
    const { data: ticket } = await admin
      .from("support_tickets")
      .insert({
        user_id: userId,
        category: "payment",
        status: "open",
        payment_request_id: requestId,
        last_message_at: now,
        // Nothing to catch up on yet — the unread dot belongs to our reply.
        user_seen_at: now,
      })
      .select("id")
      .single();
    if (!ticket) return;

    // The customer's own note becomes the first message, so the thread opens
    // with what they said rather than with an empty box under a system line.
    if (note) {
      await admin
        .from("support_messages")
        .insert({ ticket_id: ticket.id, sender: "user", body: note });
    }
  } catch (err) {
    console.error("[payment] could not open the payment thread:", err);
  }
}

/**
 * The customer writes on their own payment thread.
 *
 * Deliberately not behind the paywall, and deliberately not `requirePaidUser`:
 * the entire population of this screen is people who have paid and are waiting
 * to be let in. Gating it would be the exact failure it exists to fix.
 */
export async function sendPaymentMessage(body: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const text = body.trim().slice(0, 2000);
  if (!text) return fail("Write your message first.");

  const supabase = await createClient();

  // Their own open request, and the thread hanging off it. RLS scopes both to
  // the caller (migrations 034 and 044), so there is nothing to widen here.
  const { data: request } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) return fail("No payment in progress.");

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("payment_request_id", request.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) return fail("No conversation to write to yet.");

  // A conversation about one transfer, not a message queue. Without a ceiling
  // this is an unauthenticated-in-effect way to fire an unbounded number of
  // Telegram notifications at an admin's phone, and to grow one thread past
  // what the checkout card can render. Fifty is far past any real exchange.
  const { count } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id)
    .eq("sender", "user");
  if ((count ?? 0) >= MAX_THREAD_MESSAGES) {
    return fail("This conversation is full — please contact us directly.");
  }

  const { error } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticket.id, sender: "user", body: text });
  if (error) return fail(error.message);

  const now = new Date().toISOString();
  await supabase
    .from("support_tickets")
    .update({ status: "open", last_message_at: now, user_seen_at: now })
    .eq("id", ticket.id)
    .eq("user_id", user.id);

  const admin = createAdminClient();
  const context = await notifyContext(admin, user.id);
  await notifyTelegram({
    kind: "payment_message",
    name: context.name,
    email: context.email,
    body: text,
  });

  revalidatePath("/checkout");
  revalidatePath("/admin");
  return ok(undefined);
}

/** The customer opened the thread — clears the unread dot on their side. */
export async function markPaymentThreadSeen(ticketId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ user_seen_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);
  return ok(undefined);
}

/**
 * Has this account been activated yet?
 *
 * Polled by the checkout screen while somebody waits on an admin. Activation
 * happens in a different browser entirely — an admin taps Confirm in
 * /admin — so nothing in the customer's tab knows it happened, and before this
 * the flow ended with them staring at a review screen, reloading by hand until
 * it changed.
 *
 * A poll rather than a Supabase realtime subscription, deliberately. Realtime
 * would mean adding `profiles` to the publication, which is a migration, and
 * migrations on this project are applied by hand in the SQL editor. This needs
 * no schema change and no new infrastructure, and the traffic is one indexed
 * primary-key read every few seconds from the handful of people sitting on the
 * checkout screen at any moment — which stops the instant they are let in.
 *
 * Returns a plain boolean, never the profile: this is called on a timer from
 * the client and has no business widening what that client can see.
 */
export async function isAccountActive(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("payment_status, is_admin, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  // The same predicate the proxy and the paid actions use. A separate "is
  // payment_status active?" check here would let this screen wave somebody
  // through that the gate then turns straight back around.
  return isSubscriptionActive(data);
}

/**
 * "The method I use isn't on the list."
 *
 * The picker offers four ways to pay in a country where people use a dozen,
 * and somebody who cannot find theirs has exactly one move available to them:
 * close the page. This is the cheapest alternative to that — they name what
 * they use, an admin's phone rings, and somebody answers.
 *
 * Filed as an ordinary support ticket in the `payment` category rather than
 * into a table of its own. It lands in the queue an admin already works, it is
 * already a thread the customer can be replied to in, and a second inbox
 * nobody has been told to check is worse than no inbox at all.
 *
 * Not behind the paywall, for the same reason `sendPaymentMessage` is not:
 * everybody who can reach this is by definition trying to give us money.
 */
export async function suggestPaymentMethod(body: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const text = body.trim().slice(0, 200);
  if (!text) return fail("Tell us which method you use.");

  const supabase = await createClient();

  // One suggestion per person is a suggestion; twenty is a way to make an
  // admin's phone unusable. Counting open payment tickets is enough of a
  // ceiling — a customer with three of these already has our attention.
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category", "payment");
  if ((count ?? 0) >= MAX_PAYMENT_TICKETS) {
    return fail("You've already sent us this — we'll be in touch.");
  }

  const now = new Date().toISOString();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      category: "payment",
      status: "open",
      last_message_at: now,
      // Nothing to catch up on yet — the unread dot belongs to our reply.
      user_seen_at: now,
    })
    .select("id")
    .single();
  if (error || !ticket) return fail(error?.message ?? "Could not send that.");

  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticket.id, sender: "user", body: `${SUGGESTION_PREFIX} ${text}` });
  if (messageError) {
    // Written with the service-role client: there is no DELETE policy on
    // support_tickets, so through the session this matched nothing and left
    // the empty ticket it was meant to clean up.
    await createAdminClient().from("support_tickets").delete().eq("id", ticket.id);
    return fail(messageError.message);
  }

  const admin = createAdminClient();
  await notifyTelegram({
    kind: "method_suggestion",
    ...(await notifyContext(admin, user.id)),
    method: text,
  });

  revalidatePath("/admin");
  return ok(undefined);
}
