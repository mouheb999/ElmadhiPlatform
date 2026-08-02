import { redirect } from "next/navigation";
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
        .select("id, full_name, email, phone, locale")
        .in("id", userIds)
    : { data: [] };

  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const pending = (requests ?? []).map((r) => {
    const person = byId.get(r.user_id);
    return {
      ...r,
      email: person?.email ?? null,
      fullName: person?.full_name ?? null,
      phone: person?.phone ?? null,
      userLocale: person?.locale ?? null,
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
