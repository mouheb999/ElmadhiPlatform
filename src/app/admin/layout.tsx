import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { dir } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "./admin-nav";
import { AdminCopyBar } from "@/components/admin/copy-bar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();

  // Unseen payment requests, for the nav badge. A count, not the rows — this
  // runs on every admin page and the payments page loads them properly anyway.
  const { count: unseenPayments } = await createAdminClient()
    .from("payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("admin_seen_at", null);

  return (
    <main
      dir={dir(locale)}
      // The bottom padding on a phone clears the fixed tab bar (see AdminNav).
      className="container-page flex flex-col gap-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:gap-8 md:pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:pt-[calc(2.5rem+env(safe-area-inset-top))]"
    >
      {/* items-start is load-bearing: stacked, the cross axis is horizontal, and a
          stretched flex item would pull the logo to full width and distort it. */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <Logo className="h-8 md:h-10" />
        <AdminNav locale={locale} pendingPayments={unseenPayments ?? 0} />
      </div>
      {children}

      <AdminCopyBar locale={locale} />
    </main>
  );
}
