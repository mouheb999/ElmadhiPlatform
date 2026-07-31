import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { isUnread, type SupportTicket } from "@/lib/support";
import { LoadFailure } from "@/components/shared/load-failure";
import { SupportClient } from "./support-client";

export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string | null;
};

type TicketRow = {
  id: string;
  category: string;
  status: string;
  created_at: string | null;
  last_message_at: string | null;
  last_admin_reply_at: string | null;
  user_seen_at: string | null;
  support_messages: MessageRow[] | null;
};

/** The user's own support threads: report a problem, read the answer, reply. */
export default async function SupportPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, category, status, created_at, last_message_at, last_admin_reply_at, user_seen_at, support_messages(id, sender, body, created_at)",
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "support.title")}</h1>
        <LoadFailure detail={error.message} />
      </div>
    );
  }

  const tickets: SupportTicket[] = ((data ?? []) as unknown as TicketRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    hasUnreadReply: isUnread(row.last_admin_reply_at, row.user_seen_at),
    // Sorted here rather than in the query: PostgREST orders embedded rows
    // separately and the thread must read oldest → newest.
    messages: [...(row.support_messages ?? [])]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((m) => ({
        id: m.id,
        sender: m.sender === "admin" ? ("admin" as const) : ("user" as const),
        body: m.body,
        createdAt: m.created_at,
      })),
  }));

  return <SupportClient locale={locale} tickets={tickets} />;
}
