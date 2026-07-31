import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Triage buckets, mirroring the CHECK on `support_tickets.category`.
 *
 * Lives here rather than next to the server action that validates it: a
 * `"use server"` module may only export async functions, so a shared constant
 * has nowhere to sit in that file.
 */
export const SUPPORT_CATEGORIES = ["bug", "payment", "plan", "account", "other"] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/** Narrows an arbitrary string to a category, defaulting rather than failing. */
export function toSupportCategory(value: string): SupportCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value)
    ? (value as SupportCategory)
    : "other";
}

export type SupportMessage = {
  id: string;
  sender: "user" | "admin";
  body: string;
  createdAt: string | null;
};

export type SupportTicket = {
  id: string;
  category: string;
  status: string;
  createdAt: string | null;
  lastMessageAt: string | null;
  /** An admin answer the user hasn't opened yet — drives the header dot. */
  hasUnreadReply: boolean;
  messages: SupportMessage[];
};

/** True when the admin's newest reply landed after the user last looked. */
export function isUnread(
  lastAdminReplyAt: string | null,
  userSeenAt: string | null,
): boolean {
  if (!lastAdminReplyAt) return false;
  if (!userSeenAt) return true;
  return Date.parse(lastAdminReplyAt) > Date.parse(userSeenAt);
}

/**
 * How many of the user's reports have an unanswered-for-them reply.
 *
 * Compared in JS rather than SQL because PostgREST has no column-to-column
 * filter, and a single user's ticket list is small by nature — this runs in the
 * app shell on every signed-in page, so it selects two timestamps and nothing else.
 */
export async function countUnreadSupportReplies(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("support_tickets")
    .select("last_admin_reply_at, user_seen_at")
    .eq("user_id", userId)
    .not("last_admin_reply_at", "is", null);

  return (data ?? []).filter((t) => isUnread(t.last_admin_reply_at, t.user_seen_at)).length;
}
