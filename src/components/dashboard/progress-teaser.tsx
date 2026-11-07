import { t, type Locale } from "@/lib/i18n";
import { CardTitleRow } from "@/components/shared/card-title-row";

const W = 300;
const H = 64;

/**
 * Body weight on Today: where you are now, which way it is going, and the
 * line that shows it — built from the check-ins the dashboard already
 * fetched, so it costs no queries.
 *
 * Drawn in the "body" pink, the colour the app uses for weight and
 * measurements: the figure, its unit and the line all take it, so the card
 * reads as a different kind of number from the rings above.
 *
 * `weekDone`/`weekTarget` are still accepted (the checkout preview passes
 * them) but no longer shown here: the week lives in the training ring now.
 */
export function ProgressTeaser({
  locale,
  points,
}: {
  locale: Locale;
  /** Weight points, oldest first (last ~14 with a weight value). */
  points: number[];
  weekDone?: number;
  weekTarget?: number;
}) {
  const title = <CardTitleRow title={t(locale, "home.weight")} href="/progress" linkLabel={t(locale, "home.see_progress")} />;

  if (points.length < 2) {
    return (
      <section aria-label={t(locale, "home.weight")} className="card-surface flex flex-col gap-3 p-5">
        {title}
        <p className="text-[15px] leading-relaxed text-muted">{t(locale, "home.weight_empty")}</p>
      </section>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = Math.max(max - min, 0.5);
  const step = W / (points.length - 1);
  const xy = points.map((kg, i) => [i * step, 6 + (1 - (kg - min) / spread) * (H - 12)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [endX, endY] = xy[xy.length - 1];

  const latest = points[points.length - 1];
  const delta = latest - points[0];
  // Only the signed figure is isolated left-to-right. Isolating the unit with
  // it put "kg" on the wrong side of the number in Arabic, where the unit
  // follows the number in reading order — to its left.
  const deltaNumber = `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(1)}`;

  return (
    <section aria-label={t(locale, "home.weight")} className="card-surface flex flex-col gap-3 p-5">
      {title}
      <div>
        <div className="flex items-baseline gap-1 text-body">
          <span className="font-num text-[34px] font-bold leading-none">{latest.toFixed(1)}</span>
          <span className="text-[15px] font-bold uppercase">{t(locale, "session.kg")}</span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          <bdi dir="ltr">{deltaNumber}</bdi> {t(locale, "session.kg")}{" "}
          {t(locale, "home.weight_change").replace("{n}", String(points.length))}
        </p>
      </div>
      {/* A time axis reads left to right in both languages, like a chart in
          print; mirroring it would make "down" look like "up". */}
      <div dir="ltr" className="mt-1">
        <svg viewBox={`-4 0 ${W + 8} ${H}`} className="block h-auto w-full" aria-hidden="true">
          <polyline
            points={line}
            fill="none"
            stroke="var(--body)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={endX} cy={endY} r="4.5" fill="#1c1c1e" stroke="var(--body)" strokeWidth="2.25" />
        </svg>
      </div>
    </section>
  );
}
