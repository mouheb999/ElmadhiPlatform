import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

export type ConsistencyWeek = { label: string; done: number; target: number; isCurrent: boolean };

/**
 * Sessions per week vs the plan target, as dot clusters — a calendar-free
 * adherence view. A week "hits" when done >= target.
 */
export function ConsistencyGrid({
  locale,
  weeks,
  weekStreak,
}: {
  locale: Locale;
  weeks: ConsistencyWeek[];
  /** Consecutive weeks (ending now) that met the target. */
  weekStreak: number;
}) {
  const maxDots = Math.max(...weeks.map((w) => Math.max(w.target, w.done)), 1);
  const current = weeks[weeks.length - 1];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums">
          {current ? `${current.done}/${current.target}` : "0/0"}{" "}
          <span className="font-semibold text-muted">
            {t(locale, "progress.sessions_label")} {t(locale, "progress.this_week")}
          </span>
        </span>
        {weekStreak > 1 && (
          <span className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
            <Flame className="h-3.5 w-3.5" />
            {weekStreak} {t(locale, "progress.week_streak")}
          </span>
        )}
      </div>
      <div dir="ltr" className="flex items-end justify-between gap-1">
        {weeks.map((w) => (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex flex-col-reverse items-center gap-1"
              role="img"
              aria-label={`${w.label}: ${w.done}/${w.target}`}
            >
              {Array.from({ length: Math.min(maxDots, 7) }, (_, i) => {
                const isDone = i < w.done;
                const isTargetSlot = i < w.target;
                if (!isDone && !isTargetSlot) return <span key={i} className="h-2.5 w-2.5" />;
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      isDone
                        ? w.isCurrent
                          ? "bg-accent"
                          : "bg-accent/70"
                        : "border border-white/15",
                    )}
                  />
                );
              })}
            </div>
            <span className={cn("text-[9px] tabular-nums", w.isCurrent ? "font-bold text-ink" : "text-muted")}>
              {w.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
