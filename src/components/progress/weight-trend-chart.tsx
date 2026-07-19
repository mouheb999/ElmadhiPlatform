import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export type WeightPoint = { date: string; kg: number };

const W = 320;
const H = 130;
const PAD = { top: 14, right: 8, bottom: 18, left: 30 };

/**
 * Body-weight trend: daily points + a 7-day rolling average, pure SVG,
 * server-rendered. Time axis stays LTR even on the RTL locale.
 */
export function WeightTrendChart({
  locale,
  points,
}: {
  locale: Locale;
  points: WeightPoint[];
}) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-muted">{t(locale, "progress.empty_weight")}</p>;
  }

  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const span = Math.max(t1 - t0, 1);
  const kgs = points.map((p) => p.kg);
  const minKg = Math.min(...kgs) - 0.4;
  const maxKg = Math.max(...kgs) + 0.4;
  const x = (date: string) => PAD.left + ((Date.parse(date) - t0) / span) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((maxKg - kg) / (maxKg - minKg)) * (H - PAD.top - PAD.bottom);

  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const area = `${PAD.left},${H - PAD.bottom} ${line} ${x(points[points.length - 1].date).toFixed(1)},${H - PAD.bottom}`;

  // 7-day rolling average, evaluated at each point.
  const rolling = points.map((p, i) => {
    const from = Date.parse(p.date) - 6 * 86400000;
    const window = points.slice(0, i + 1).filter((q) => Date.parse(q.date) >= from);
    return { date: p.date, kg: window.reduce((s, q) => s + q.kg, 0) / window.length };
  });
  const rollingLine = rolling.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");

  const first = points[0].kg;
  const last = points[points.length - 1].kg;
  const delta = last - first;
  const trendKey =
    Math.abs(delta) < 0.3 ? "progress.trend_flat" : delta > 0 ? "progress.trend_up" : "progress.trend_down";
  const TrendIcon = Math.abs(delta) < 0.3 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  // Recessive gridlines at 3 weight levels.
  const gridKgs = [minKg + (maxKg - minKg) * 0.2, minKg + (maxKg - minKg) * 0.55, minKg + (maxKg - minKg) * 0.9];

  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-2xl font-extrabold tabular-nums">
          {last.toFixed(1)} <span className="text-sm font-bold text-muted">{t(locale, "session.kg")}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-muted">
          <TrendIcon className="h-3.5 w-3.5" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} {t(locale, "session.kg")} · {t(locale, trendKey)}
        </span>
      </div>
      <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t(locale, "progress.weight_title")}>
          <defs>
            <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5DD62C" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#5DD62C" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridKgs.map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(g)}
                y2={y(g)}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              <text x={PAD.left - 4} y={y(g) + 3} textAnchor="end" fontSize="8" fill="rgba(248,248,248,0.45)">
                {g.toFixed(1)}
              </text>
            </g>
          ))}
          <polygon points={area} fill="url(#weight-area)" />
          <polyline points={rollingLine} fill="none" stroke="rgba(248,248,248,0.35)" strokeWidth="1.5" strokeDasharray="3 3" />
          <polyline points={line} fill="none" stroke="#5DD62C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(points[points.length - 1].date)} cy={y(last)} r="3.5" fill="#5DD62C" stroke="#202020" strokeWidth="1.5" />
          <text x={PAD.left} y={H - 5} fontSize="8" fill="rgba(248,248,248,0.45)">
            {fmtDay(points[0].date)}
          </text>
          <text x={W - PAD.right} y={H - 5} textAnchor="end" fontSize="8" fill="rgba(248,248,248,0.45)">
            {fmtDay(points[points.length - 1].date)}
          </text>
        </svg>
      </div>
    </div>
  );
}
