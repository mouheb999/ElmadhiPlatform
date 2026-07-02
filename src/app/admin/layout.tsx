import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { dir } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();

  return (
    <main dir={dir(locale)} className="container-page flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <AdminNav locale={locale} />
      </div>
      {children}
    </main>
  );
}
