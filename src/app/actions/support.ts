"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { requireAdmin } from "@/lib/auth";
import { toSupportCategory } from "@/lib/support";
import { notifyTelegram } from "@/lib/notify/telegram";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * "Report a problem" — the support thread behind the header icon.
 *
 * User writes go through the session client so RLS applies (migration 034);
 * admin writes go through the service-role client, because a ticket belongs to
 * the user who opened it and RLS deliberately shows an admin nothing.
 */

const MAX_BODY = 2000;

function cleanBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_BODY);
}

/** Open a new report. Returns the ticket so the client can show the thread. */
export async function submitSupportTicket(input: {
  category: string;
  body: string;
}): Promise<ActionResult<{ ticketId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const body = cleanBody(input.body);
  if (!body) return fail("Write what went wrong first.");

  const category = toSupportCategory(input.category);
  const now = new Date().toISOString();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      category,
      status: "open",
      last_message_at: now,
      // Nothing to catch up on yet — the dot should only appear on a reply.
      user_seen_at: now,
    })
    .select("id")
    .single();
  if (error || !ticket) return fail(error?.message ?? "Could not send your report.");

  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticket.id, sender: "user", body });
  if (messageError) {
    // An empty thread would show the admin a report with no text in it.
    //
    // With the service-role client, because there is no DELETE policy on
    // `support_tickets` — through the session client this statement matched no
    // rows, reported success, and left exactly the empty ticket it was written
    // to clean up.
    await createAdminClient().from("support_tickets").delete().eq("id", ticket.id);
    return fail(messageError.message);
  }

  // Same reason the payment flow pings: a report sitting in a table nobody has
  // been told about is a report nobody answers, and "I paid and I'm still
  // locked out" arrives through this door. Best-effort — a notification
  // failure must never fail a report that was filed successfully.
  const db = createAdminClient();
  const { data: reporter } = await db
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();
  await notifyTelegram({
    kind: "support_ticket",
    name: reporter?.full_name ?? null,
    email: reporter?.email ?? null,
    phone: reporter?.phone ?? null,
    category,
    body,
  });

  revalidatePath("/support");
  return ok({ ticketId: ticket.id });
}

/** User adds to an existing thread — which puts it back in the admin queue. */
export async function replyToSupportTicket(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const text = cleanBody(body);
  if (!text) return fail("Write your message first.");

  const { error } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, sender: "user", body: text });
  if (error) return fail(error.message);

  const now = new Date().toISOString();
  await supabase
    .from("support_tickets")
    .update({ status: "open", last_message_at: now, user_seen_at: now })
    .eq("id", ticketId)
    .eq("user_id", user.id);

  revalidatePath("/support");
  return ok(undefined);
}

/** User opened the thread — clears the unread dot in the header. */
export async function markSupportSeen(ticketId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const { error } = await supabase
    .from("support_tickets")
    .update({ user_seen_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/support");
  return ok(undefined);
}

/** Admin answers. The reply is what makes the user's header dot light up. */
export async function answerSupportTicket(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const text = cleanBody(body);
  if (!text) return fail("Write an answer first.");

  const db = createAdminClient();
  const { error } = await db
    .from("support_messages")
    .insert({ ticket_id: ticketId, sender: "admin", body: text });
  if (error) return fail(error.message);

  const now = new Date().toISOString();
  const { error: ticketError } = await db
    .from("support_tickets")
    .update({ status: "answered", last_message_at: now, last_admin_reply_at: now })
    .eq("id", ticketId);
  if (ticketError) return fail(ticketError.message);

  revalidatePath("/admin/support");
  revalidatePath("/support");
  return ok(undefined);
}

/** Admin closes a thread. The user can still reopen it by writing again. */
export async function setSupportTicketStatus(
  ticketId: string,
  status: "open" | "closed",
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const db = createAdminClient();
  const { error } = await db.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) return fail(error.message);

  revalidatePath("/admin/support");
  revalidatePath("/support");
  return ok(undefined);
}
