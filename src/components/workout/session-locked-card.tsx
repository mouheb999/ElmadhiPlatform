import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";

export type LockedDayStats = {
  setCount: number;
  volumeKg: number;
  minutes: number;
  prCount: number;
};

/**
 * Shown instead of the logging UI when this program day was already
 * completed this week: the workout is a done deal — celebrate it, show the
 * numbers, and point at Monday.
 */
export function SessionLockedCard({
  locale,
  dayName,
  stats,
}: {
  locale: Locale;
  dayName: string;
  stats: LockedDayStats;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15">
        <CheckCircle2 className="h-10 w-10 text-accent" />
      </div>
      <div>
        <h1 className="text-2xl font-extrabold">{dayName}</h1>
        <p className="mt-1 font-bold text-accent">{t(locale, "session.locked_title")}</p>
        <p className="mt-1 text-sm text-muted">{t(locale, "session.locked_sub")}</p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Stat label={t(locale, "session.stat_sets")} value={String(stats.setCount)} />
        <Stat label={t(locale, "session.stat_volume")} value={String(stats.volumeKg)} />
        <Stat label={t(locale, "session.stat_minutes")} value={String(stats.minutes)} />
        <Stat label={t(locale, "session.stat_prs")} value={String(stats.prCount)} />
      </div>
      <p className="flex items-center gap-2 text-sm font-bold text-muted">
        <Lock className="h-4 w-4" />
        {t(locale, "session.week_locked")}
      </p>
      <Button asChild variant="secondary" className="w-full max-w-sm">
        <Link href="/workout/program">{t(locale, "session.go_program")}</Link>
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
