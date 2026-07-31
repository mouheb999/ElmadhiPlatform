import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";

/**
 * Shown instead of the questionnaire once a user has spent this month's plan
 * rebuilds. It stands in front of the wizard on purpose: finding out after
 * twenty questions that the answers can't be saved is the worst version of
 * this limit.
 */
export function RedoLimitCard({ locale, limit }: { locale: Locale; limit: number }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-surface p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/15">
        <CalendarClock className="h-7 w-7 text-accent" />
      </div>
      <div>
        <h1 className="text-xl font-extrabold">{t(locale, "redo.limit_title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t(locale, "redo.quota_blocked").replace("{total}", String(limit))}
        </p>
      </div>
      <Button asChild variant="secondary" className="w-full">
        <Link href="/settings">{t(locale, "redo.back_to_settings")}</Link>
      </Button>
    </div>
  );
}
