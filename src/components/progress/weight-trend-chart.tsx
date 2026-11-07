import { t, type Locale } from "@/lib/i18n";

export type WeightPoint = { date: string; kg: number };

const W = 320;
const H = 160;
const PAD = { top: 12, right: 40, bottom: 24, left: 4 };

/** "12 Oct" / "12 أكتوبر" for a YYYY-MM-DD key. */
export function shortDate(locale: Locale, key: string): string {
  return new Intl.DateTimeFormat(locale === "tn" ? "ar-TN" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
}

/** 7-day rolling average, evaluated at each weigh-in. */
function rollingAverage(points: WeightPoint[]): WeightPoint[] {
  return points.map((p, i) => {
    const from = Date.parse(p.date) - 6 * 86400000;
    const window = points.slice(0, i + 1).filter((q) => Date.parse(q.date) >= from);
    return { date: p.date, kg: window.reduce((s, q) => s + q.kg, 0) / window.length };
  });
}

/**
 * Body weight over the chosen range.
 *
 * Two layers, because a single line of daily weigh-ins mostly shows water
 * and salt: faint dots for each day, and a solid line for the 7-day average,
 * which is the trend worth acting on. The legend underneath says which is
 * which in words. Weight labels sit on the right edge in kilos, with three
 * dates along the bottom.
 *
 * Purple, the colour weight wears on Today. The time axis runs left to right
 * in Arabic too, as charts do in print — mirrored, "down" would look like "up".
 */
export function WeightTrendChart({ locale, points }: { locale: Locale; points: WeightPoint[] }) {
  if (points.length < 2) {
    // One weigh-in is a number, not a trend: the card's headline already shows
    // it, so say what's missing rather than "log your weight" under a weight.
    return (
      <p className="py-6 text-center text-[15px] text-muted">
        {t(locale, points.length === 1 ? "progress.weight_need_more" : "progress.empty_weight")}
      </p>
    );
  }

  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const span = Math.max(t1 - t0, 1);
  const kgs = points.map((p) => p.kg);
  // Gridlines on round half-kilos, with at least 1 kg of range so a flat
  // fortnight doesn't blow tiny wobbles up to fill the chart.
  let lo = Math.floor((Math.min(...kgs) - 0.3) * 2) / 2;
  let hi = Math.ceil((Math.max(...kgs) + 0.3) * 2) / 2;
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2;
    lo = Math.floor((mid - 0.5) * 2) / 2;
    hi = lo + 1;
  }
  const x = (date: string) => PAD.left + ((Date.parse(date) - t0) / span) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const avg = rollingAverage(points);
  const avgLine = avg.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const lastAvg = avg[avg.length - 1];
  const grid = [lo, (lo + hi) / 2, hi];
  const mid = points[Math.floor(points.length / 2)];

  return (
    <div className="flex flex-col gap-3">
      <div dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={t(locale, "progress.weight_title")}
        >
          {grid.map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right + 4}
                y1={y(g)}
                y2={y(g)}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={W - 2}
                y={y(g) + 4}
                textAnchor="end"
                fontSize="10.5"
                fill="rgba(255,255,255,0.5)"
                style={{ fontFamily: "var(--font-num)" }}
              >
                {g.toFixed(1)}
              </text>
            </g>
          ))}

          {points.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r="2.6" fill="var(--body)" fillOpacity="0.45" />
          ))}

          <polyline
            points={avgLine}
            fill="none"
            stroke="var(--body)"
            strokeWidth="2.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={x(lastAvg.date)}
            cy={y(lastAvg.kg)}
            r="5"
            fill="#1c1c1e"
            stroke="var(--body)"
            strokeWidth="2.75"
          />

          {[points[0], mid, points[points.length - 1]].map((p, i) => (
            <text
              key={`${p.date}-${i}`}
              x={i === 0 ? PAD.left : i === 2 ? W - PAD.right : x(p.date)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fontSize="10.5"
              fill="rgba(255,255,255,0.5)"
            >
              {shortDate(locale, p.date)}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-body/50" aria-hidden />
          {t(locale, "progress.legend_daily")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-body" aria-hidden />
          {t(locale, "progress.legend_avg")}
        </span>
      </div>
    </div>
  );
}
