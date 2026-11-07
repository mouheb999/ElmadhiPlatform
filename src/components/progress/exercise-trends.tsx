import { t, type Locale } from "@/lib/i18n";

export type ExerciseTrend = {
  exerciseId: string;
  name: string;
  /** Heaviest set per week, oldest first, weeks with no sets left out. */
  points: { label: string; kg: number }[];
};

const W = 64;
const H = 28;

/**
 * The most-trained exercises, one row each.
 *
 * Every row answers the same question in the same order: what is it, where
 * did you start, where are you now, and by how much did it move. The name
 * gets the full width it needs (it used to be cut off in a half-width tile),
 * the starting weight is said in words underneath, and the change is a
 * coloured "+5 kg" rather than a bare number with no sign of what it means.
 */
export function ExerciseTrends({ locale, exercises }: { locale: Locale; exercises: ExerciseTrend[] }) {
  if (exercises.length === 0) {
    return <p className="py-6 text-center text-[15px] text-muted">{t(locale, "progress.empty_strength")}</p>;
  }
  const kg = t(locale, "session.kg");

  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {exercises.map((ex) => {
        const kgs = ex.points.map((p) => p.kg);
        const first = kgs[0] ?? 0;
        const latest = kgs[kgs.length - 1] ?? 0;
        const delta = Math.round((latest - first) * 10) / 10;
        const min = Math.min(...kgs);
        const spread = Math.max(Math.max(...kgs) - min, 1);
        const step = kgs.length > 1 ? W / (kgs.length - 1) : 0;
        const line = kgs
          .map((v, i) => `${(i * step).toFixed(1)},${(H - 3 - ((v - min) / spread) * (H - 6)).toFixed(1)}`)
          .join(" ");

        return (
          <li key={ex.exerciseId} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold leading-snug">{ex.name}</div>
              <div className="mt-0.5 text-[13px] text-muted">
                {kgs.length > 1
                  ? t(locale, "progress.started_at").replace("{n}", String(first))
                  : t(locale, "progress.first_logged")}
              </div>
            </div>

            {kgs.length > 1 && (
              <svg viewBox={`-3 0 ${W + 6} ${H}`} className="h-7 w-16 shrink-0" style={{ direction: "ltr" }} aria-hidden>
                <polyline
                  points={line}
                  fill="none"
                  stroke="var(--train)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}

            <div className="flex w-[5.5rem] shrink-0 flex-col items-end">
              <span className="flex items-baseline gap-0.5 text-train">
                <span className="font-num text-[22px] font-bold leading-tight">{latest}</span>
                <span className="text-[13px] font-bold uppercase">{kg}</span>
              </span>
              {kgs.length > 1 && (
                <span
                  className={
                    delta > 0
                      ? "text-[13px] font-semibold text-train"
                      : delta < 0
                        ? "text-[13px] font-semibold text-danger"
                        : "text-[13px] font-semibold text-muted"
                  }
                >
                  {delta === 0 ? (
                    t(locale, "progress.same")
                  ) : (
                    <>
                      <bdi dir="ltr">{`${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}</bdi> {kg}
                    </>
                  )}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
