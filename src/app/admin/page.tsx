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

  const [{ data: settings }, { data: methods }, { data: requests }] =
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
    ]);

  // Resolve emails for the pending requests so the admin can match WhatsApp.
  const pending = await Promise.all(
    (requests ?? []).map(async (r) => {
      const { data } = await db.auth.admin.getUserById(r.user_id);
      return { ...r, email: data.user?.email ?? null };
    }),
  );

  return (
    <AdminClient
      locale={locale}
      settings={settings ?? null}
      methods={methods ?? []}
      requests={pending}
    />
  );
}
