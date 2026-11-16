import { redirect } from "next/navigation";
import { hoursSince } from "@/lib/dates";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();
  const db = createAdminClient();

  const [{ data: settings }, { data: methods }, { data: requests }, { data: plans }] =
    await Promise.all([
      db.from("payment_settings").select("*").eq("id", 1).maybeSingle(),
      db
        .from("payment_methods")
        .select("*")
        .order("order_index", { ascending: true }),
      db
        .from("payment_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      db
        .from("subscription_plans")
        .select("*")
        .order("tier", { ascending: false })
        .order("months", { ascending: true }),
    ]);

  // Who each request belongs to, so the admin can chase them on WhatsApp
  // without leaving the panel.
  //
  // One query keyed by id, not a getUserById per request: that was a round-trip
  // per pending payment, and it could only ever return an email. `profiles`
  // carries the name and number too — and the number is the whole point, since
  // confirming a manual payment means asking for the transfer screenshot.
  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const { data: people } = userIds.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, phone, locale, contacted_at")
        .in("id", userIds)
    : { data: [] };

  // The receipt the customer uploaded. The bucket is private (migration 041)
  // because these are screenshots of banking apps, so the panel renders a
  // short-lived signed URL rather than a public one. Ten minutes is longer than
  // anyone spends on this page and short enough that a leaked page source is
  // not a lasting handle on somebody's bank details.
  const proofPaths = (requests ?? [])
    .map((r) => r.proof_path)
    .filter((p): p is string => !!p);
  const { data: signed } = proofPaths.length
    ? await db.storage.from("payment-proofs").createSignedUrls(proofPaths, 600)
    : { data: [] };
  const proofUrlByPath = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl]),
  );

  // The conversation attached to each request (migration 044), so an admin can
  // answer "your transfer is 5 DT short" without leaving the queue — which was
  // previously only possible by copying a phone number into WhatsApp.
  const requestIds = (requests ?? []).map((r) => r.id);
  const { data: tickets } = requestIds.length
    ? await db
        .from("support_tickets")
        .select("id, payment_request_id, support_messages(id, sender, body, created_at)")
        .in("payment_request_id", requestIds)
    : { data: [] };

  type TicketRow = {
    id: string;
    payment_request_id: string | null;
    support_messages: { id: string; sender: string; body: string; created_at: string | null }[];
  };
  const threadByRequest = new Map(
    ((tickets ?? []) as unknown as TicketRow[])
      .filter((ticket) => ticket.payment_request_id)
      .map((ticket) => [
        ticket.payment_request_id as string,
        {
          ticketId: ticket.id,
          messages: (ticket.support_messages ?? [])
            .slice()
            .sort((a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""))
            .map((m) => ({
              id: m.id,
              sender: m.sender === "admin" ? ("admin" as const) : ("user" as const),
              body: m.body,
              createdAt: m.created_at,
            })),
        },
      ]),
  );

  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const pending = (requests ?? []).map((r) => {
    const person = byId.get(r.user_id);
    return {
      ...r,
      email: person?.email ?? null,
      fullName: person?.full_name ?? null,
      phone: person?.phone ?? null,
      userLocale: person?.locale ?? null,
      contactedAt: person?.contacted_at ?? null,
      proofUrl: r.proof_path ? (proofUrlByPath.get(r.proof_path) ?? null) : null,
      isNew: !r.admin_seen_at,
      // Computed here rather than in the client component: reading the clock
      // during a client render is impure and would hydrate to a different
      // number than the server sent. The page is force-dynamic, so this is a
      // fresh snapshot on every load, which is all the badge needs.
      waitingHours: hoursSince(r.created_at),
      thread: threadByRequest.get(r.id) ?? null,
    };
  });

  return (
    <AdminClient
      locale={locale}
      settings={settings ?? null}
      methods={methods ?? []}
      requests={pending}
      plans={plans ?? []}
    />
  );
}
