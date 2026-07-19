import { t, type Locale } from "@/lib/i18n";

export type ExerciseTrend = {
  exerciseId: string;
  name: string;
  points: { label: string; kg: number }[];
};

const W = 120;
const H = 36;

/** Top-weight sparkline tiles for the user's most-trained exercises. */
export function ExerciseTrends({
  locale,
  exercises,
}: {
  locale: Locale;
  exercises: ExerciseTrend[];
}) {
  if (exercises.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t(locale, "progress.empty_strength")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {exercises.map((ex) => {
        const kgs = ex.points.map((p) => p.kg);
        const latest = kgs[kgs.length - 1] ?? 0;
        const first = kgs[0] ?? 0;
        const delta = latest - first;
        const min = Math.min(...kgs);
        const max = Math.max(...kgs);
        const spread = Math.max(max - min, 1);
        const step = ex.points.length > 1 ? W / (ex.points.length - 1) : 0;
        const line = ex.points
          .map((p, i) => `${(i * step).toFixed(1)},${(H - 4 - ((p.kg - min) / spread) * (H - 8)).toFixed(1)}`)
          .join(" ");
        return (
          <div key={ex.exerciseId} className="rounded-2xl border border-hairline bg-surface p-3">
            <div className="truncate text-xs font-bold" title={ex.name}>
              {ex.name}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold tabular-nums">{latest}</span>
              <span className="text-[10px] font-bold text-muted">{t(locale, "session.kg")}</span>
              {delta !== 0 && (
                <span
                  className={`text-[10px] font-bold tabular-nums ${delta > 0 ? "text-accent" : "text-red-400"}`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              )}
            </div>
            {ex.points.length > 1 && (
              <div dir="ltr" className="mt-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
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
          </div>
        );
      })}
    </div>
  );
}
