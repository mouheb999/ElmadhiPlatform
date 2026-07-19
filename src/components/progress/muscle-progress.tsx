import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export type MuscleRow = {
  muscle: string;
  label: string;
  recentKg: number;
  prevKg: number;
};

/**
 * Where the work is going: volume per muscle group, last 4 weeks (accent)
 * against the 4 before (recessive reference bar), with a per-muscle delta.
 */
export function MuscleProgress({
  locale,
  rows,
}: {
  locale: Locale;
  rows: MuscleRow[];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t(locale, "progress.empty_strength")}</p>;
  }
  const max = Math.max(...rows.map((r) => Math.max(r.recentKg, r.prevKg)), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-accent" /> {t(locale, "progress.recent_label")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-white/20" /> {t(locale, "progress.prior_label")}
        </span>
      </div>
      {rows.map((r) => {
        const delta = r.prevKg > 0 ? ((r.recentKg - r.prevKg) / r.prevKg) * 100 : r.recentKg > 0 ? 100 : 0;
        const DeltaIcon = Math.abs(delta) < 5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
        return (
          <div key={r.muscle}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-bold">{r.label}</span>
              <span
                className={
                  Math.abs(delta) < 5
                    ? "flex items-center gap-1 font-bold text-muted"
                    : delta > 0
                      ? "flex items-center gap-1 font-bold text-accent"
                      : "flex items-center gap-1 font-bold text-red-400"
                }
              >
                <DeltaIcon className="h-3 w-3" />
                {delta > 0 ? "+" : ""}
                {Math.round(delta)}%
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max((r.recentKg / max) * 100, r.recentKg > 0 ? 2 : 0)}%` }}
                />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-white/20"
                  style={{ width: `${Math.max((r.prevKg / max) * 100, r.prevKg > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
