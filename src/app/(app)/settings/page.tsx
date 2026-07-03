import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { signOut } from "@/app/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();

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
          <Link href="/diet/questions?redo=1" className="p-6 font-bold hover:bg-white/5">
            {t(locale, "settings.redo_diet")}
          </Link>
          <Link href="/workout/questions?redo=1" className="p-6 font-bold hover:bg-white/5">
            {t(locale, "settings.redo_workout")}
          </Link>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          {t(locale, "settings.sign_out")}
        </Button>
      </form>
    </div>
  );
}
