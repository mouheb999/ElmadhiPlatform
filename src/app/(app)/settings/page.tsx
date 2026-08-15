import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { getAdminUser } from "@/lib/auth";
import { EditModeToggle } from "@/components/admin/edit-mode-toggle";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getRedoQuotas, MONTHLY_REDO_LIMIT, type RedoQuota } from "@/lib/plan-redo";
import { signOut } from "@/app/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export const dynamic = "force-dynamic";

const SPENT: RedoQuota = { limit: MONTHLY_REDO_LIMIT, used: MONTHLY_REDO_LIMIT, remaining: 0 };

/**
 * One "redo my plan" row. Once the month's rebuilds are spent the row stops
 * being a link — the questionnaire would refuse the answers at the end anyway.
 */
function RedoRow({
  locale,
  href,
  labelKey,
  quota,
}: {
  locale: Locale;
  href: string;
  labelKey: StringKey;
  quota: RedoQuota;
}) {
  const left = t(locale, "redo.remaining")
    .replace("{remaining}", String(quota.remaining))
    .replace("{total}", String(quota.limit));

  if (quota.remaining <= 0) {
    return (
      <div className="p-6">
        <span className="font-bold text-muted">{t(locale, labelKey)}</span>
        <p className="mt-1 text-sm text-muted">{t(locale, "redo.none_left")}</p>
      </div>
    );
  }

  return (
    <Link href={href} className="p-6 hover:bg-white/5">
      <span className="font-bold">{t(locale, labelKey)}</span>
      <p className="mt-1 text-sm text-muted">{left}</p>
    </Link>
  );
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const [admin, user] = await Promise.all([getAdminUser(), getCurrentUser()]);
  const supabase = await createClient();
  const quotas = user
    ? await getRedoQuotas(supabase, user.id)
    : { diet: SPENT, workout: SPENT };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "settings.title")}</h1>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <span className="font-bold">{t(locale, "settings.language")}</span>
          <LanguageSwitcher locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col divide-y divide-hairline p-0">
          <RedoRow
            locale={locale}
            href="/diet/questions?redo=1"
            labelKey="settings.redo_diet"
            quota={quotas.diet}
          />
          <RedoRow
            locale={locale}
            href="/workout/questions?redo=1"
            labelKey="settings.redo_workout"
            quota={quotas.workout}
          />
        </CardContent>
      </Card>

      {admin && (
        <Card>
          <CardContent className="flex flex-col p-0">
            <Link href="/admin" className="block p-6 font-bold text-accent hover:bg-white/5">
              {t(locale, "settings.admin_panel")}
            </Link>
            <span className="border-t border-hairline" />
            <EditModeToggle label={t(locale, "settings.edit_mode")} />
          </CardContent>
        </Card>
      )}

      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          {t(locale, "settings.sign_out")}
        </Button>
      </form>
    </div>
  );
}
