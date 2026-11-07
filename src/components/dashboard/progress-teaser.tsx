import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

const W = 300;
const H = 64;

/**
 * Body weight on Today: where you are now, which way it is going, and the
 * line that shows it — built from the check-ins the dashboard already
 * fetched, so it costs no queries.
 *
 * Drawn in the "body" pink, the colour the app uses for weight and
 * measurements, so the trend reads as a different kind of number from the
 * rings above it.
 *
 * `weekDone`/`weekTarget` are still accepted (the checkout preview passes
 * them) but no longer shown here: the week now lives in the training ring at
 * the top of the screen, and showing it twice was noise.
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
  const header = (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[22px] font-bold tracking-[-0.015em]">{t(locale, "home.weight")}</h2>
      <Link href="/progress" transitionTypes={["tab"]} className="press flex items-center text-[15px] text-[#D4D4D8]">
        {t(locale, "home.see_progress")}
        <ChevronRight className="h-[18px] w-[18px] rtl:rotate-180" />
      </Link>
    </div>
  );

  if (points.length < 2) {
    return (
      <section aria-label={t(locale, "home.weight")}>
        {header}
        <p className="rounded-card bg-surface p-5 text-[15px] leading-relaxed text-muted">{t(locale, "home.weight_empty")}</p>
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
  const deltaText = `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(1)} ${t(locale, "session.kg")}`;

  return (
    <section aria-label={t(locale, "home.weight")}>
      {header}
      <div className="rounded-card bg-surface px-5 pb-[18px] pt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-num text-[34px] font-bold leading-none">{latest.toFixed(1)}</span>
          <span className="text-[15px] text-muted">{t(locale, "session.kg")}</span>
          <span className="ms-auto text-[13px] text-muted">
            <bdi dir="ltr">{deltaText}</bdi>{" "}
            {t(locale, "home.weight_change").replace("{n}", String(points.length))}
          </span>
        </div>
        {/* A time axis reads left to right in both languages, like a chart in
            print; mirroring it would make "down" look like "up". */}
        <div dir="ltr" className="mt-3.5">
          <svg viewBox={`-4 0 ${W + 8} ${H}`} className="block h-auto w-full" aria-hidden="true">
            <polyline
              points={line}
              fill="none"
              stroke="var(--body)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={endX} cy={endY} r="4" fill="var(--surface)" stroke="var(--body)" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </section>
  );
}
