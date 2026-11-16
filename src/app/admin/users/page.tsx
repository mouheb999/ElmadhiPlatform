import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { AdminUsersClient } from "./users-client";
import { AdminHeader } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

/** Per-user record admin. Today: reset a user's logged workout history after
 *  an accidental or test session. AdminLayout gates access; the lookup and
 *  the reset both re-verify admin server-side. */
export default async function AdminUsersPage() {
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader title={t(locale, "admin.users_title")} sub={t(locale, "admin.users_sub")} />
      <AdminUsersClient locale={locale} />
    </div>
  );
}
