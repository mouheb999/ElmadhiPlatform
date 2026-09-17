"use client";

import { t, type Locale } from "@/lib/i18n";
import { sampleCurve, type Projection } from "@/lib/funnel/projection";

const W = 320;
const H = 150;
const PAD = { top: 26, right: 14, bottom: 26, left: 14 };

/**
 * The curve from today's weight to the one they typed.
 *
 * Deliberately not a straight line — `projectWeight` re-runs the plan's own
 * macro engine every simulated week, so the rate falls as the body does and
 * the curve flattens. Anybody who has dieted knows a straight line is a lie,
 * and a chart that admits the slowdown is more persuasive than one that does
 * not, not less.
 *
 * Time reads left to right in both locales. The Arabic UI is RTL, but a
 * timeline is not text: mirroring it would put the future on the left, which
 * nobody reads that way on a chart.
 */
export function ProjectionChart({
  locale,
  projection,
}: {
  locale: Locale;
  projection: Projection;
}) {
  const points = sampleCurve(projection.points);
  const kgs = points.map((p) => p.kg);
  const lastWeek = points[points.length - 1].week || 1;

  // A little headroom either side so the end dots are not clipped by the
  // viewBox and the line does not sit flat against the frame.
  const minKg = Math.min(...kgs) - 0.6;
  const maxKg = Math.max(...kgs) + 0.6;
  const span = Math.max(maxKg - minKg, 0.1);

  const x = (week: number) => PAD.left + (week / lastWeek) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((maxKg - kg) / span) * (H - PAD.top - PAD.bottom);

  const line = points.map((p) => `${x(p.week).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${H - PAD.bottom} ${line} ${x(lastWeek).toFixed(1)},${H - PAD.bottom}`;

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <div dir="ltr" className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${start.kg.toFixed(1)} kg → ${end.kg.toFixed(1)} kg`}
      >
        <defs>
          <linearGradient id="fn-proj-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C0DA1B" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#C0DA1B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The target, as the line the curve is walking down to. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(end.kg)}
          y2={y(end.kg)}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <polygon points={area} fill="url(#fn-proj-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#C0DA1B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={x(0)} cy={y(start.kg)} r="4.5" fill="#F8F8F8" />
        <circle cx={x(lastWeek)} cy={y(end.kg)} r="5.5" fill="#C0DA1B" />
        <circle cx={x(lastWeek)} cy={y(end.kg)} r="10" fill="#C0DA1B" fillOpacity="0.2" />

        <text
          x={x(0)}
          y={y(start.kg) - 12}
          textAnchor="start"
          className="fill-ink text-[11px] font-bold"
        >
          {start.kg.toFixed(1)} kg
        </text>
        <text
          x={x(lastWeek)}
          y={y(end.kg) - 16}
          textAnchor="end"
          className="fill-accent text-[12px] font-extrabold"
        >
          {end.kg.toFixed(1)} kg
        </text>
      </svg>

      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-muted">
        <span>{t(locale, "fn.r_today")}</span>
        <span>{t(locale, "fn.r_target")}</span>
      </div>
    </div>
  );
}
