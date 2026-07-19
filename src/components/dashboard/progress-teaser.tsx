import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

const W = 140;
const H = 36;

/**
 * Dashboard → /progress teaser: a body-weight sparkline built from the
 * check-ins the dashboard already fetched. Zero extra queries.
 */
export function ProgressTeaser({
  locale,
  points,
  weekDone,
  weekTarget,
}: {
  locale: Locale;
  /** Weight points, oldest first (last ~14 with a weight value). */
  points: number[];
  weekDone: number;
  weekTarget: number;
}) {
  const hasLine = points.length > 1;
  let line = "";
  if (hasLine) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const spread = Math.max(max - min, 0.5);
    const step = W / (points.length - 1);
    line = points
      .map((kg, i) => `${(i * step).toFixed(1)},${(H - 3 - ((kg - min) / spread) * (H - 6)).toFixed(1)}`)
      .join(" ");
  }

  return (
    <Link
      href="/progress"
      className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:bg-white/5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-bold">
          <TrendingUp className="h-4 w-4 text-accent" />
          {t(locale, "dashboard.progress_title")}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {weekTarget > 0
            ? `${weekDone}/${weekTarget} ${t(locale, "progress.sessions_label")} · `
            : ""}
          {t(locale, "dashboard.progress_cta")}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasLine && (
          <div dir="ltr">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-[8.75rem]" aria-hidden="true">
              <polyline
                points={line}
                fill="none"
                stroke="#5DD62C"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" />
      </div>
    </Link>
  );
}
