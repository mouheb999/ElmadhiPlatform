import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { AdminUsersClient } from "./users-client";

export const dynamic = "force-dynamic";

/** Per-user record admin. Today: reset a user's logged workout history after
 *  an accidental or test session. AdminLayout gates access; the lookup and
 *  the reset both re-verify admin server-side. */
export default async function AdminUsersPage() {
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t(locale, "admin.users_title")}
        </h1>
        <p className="text-muted">{t(locale, "admin.users_sub")}</p>
      </div>
      <AdminUsersClient locale={locale} />
    </div>
  );
}
