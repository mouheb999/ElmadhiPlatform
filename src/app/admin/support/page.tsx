import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoadFailure } from "@/components/shared/load-failure";
import { SupportAdminClient, type AdminTicket } from "./support-admin-client";

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
  profiles: { email: string | null; full_name: string | null } | null;
  support_messages: MessageRow[] | null;
};

/**
 * Problem reports from users. AdminLayout gates access; the read uses the
 * service-role client because support_tickets RLS only exposes a user's own
 * rows — an admin has no policy that would show them anyone else's.
 */
export default async function AdminSupportPage() {
  const locale = await getLocale();
  const db = createAdminClient();

  const { data, error } = await db
    .from("support_tickets")
    .select(
      "id, category, status, created_at, last_message_at, profiles(email, full_name), support_messages(id, sender, body, created_at)",
    )
    .order("last_message_at", { ascending: false });

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "admin.support_title")}</h1>
        <LoadFailure detail={error.message} />
      </div>
    );
  }

  const tickets: AdminTicket[] = ((data ?? []) as unknown as TicketRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    email: row.profiles?.email ?? null,
    fullName: row.profiles?.full_name ?? null,
    messages: [...(row.support_messages ?? [])]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((m) => ({
        id: m.id,
        sender: m.sender === "admin" ? ("admin" as const) : ("user" as const),
        body: m.body,
        createdAt: m.created_at,
      })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "admin.support_title")}</h1>
        <p className="text-muted">{t(locale, "admin.support_sub")}</p>
      </div>
      <SupportAdminClient locale={locale} tickets={tickets} />
    </div>
  );
}
