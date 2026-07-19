import { t, type Locale } from "@/lib/i18n";

export type VolumeWeek = { label: string; volumeKg: number; isCurrent: boolean };

const W = 320;
const H = 120;
const PAD = { top: 16, right: 4, bottom: 16, left: 4 };

/** Rounded-top bar path anchored flat on the baseline (mark spec). */
function barPath(x: number, yTop: number, width: number, yBase: number, r: number): string {
  const rr = Math.min(r, width / 2, Math.max(yBase - yTop, 0));
  return [
    `M ${x} ${yBase}`,
    `V ${yTop + rr}`,
    `Q ${x} ${yTop} ${x + rr} ${yTop}`,
    `H ${x + width - rr}`,
    `Q ${x + width} ${yTop} ${x + width} ${yTop + rr}`,
    `V ${yBase}`,
    "Z",
  ].join(" ");
}

/** Total training volume per Tunis week — the strength workload trend. */
export function WeeklyVolumeChart({
  locale,
  weeks,
}: {
  locale: Locale;
  weeks: VolumeWeek[];
}) {
  const max = Math.max(...weeks.map((w) => w.volumeKg), 1);
  if (weeks.every((w) => w.volumeKg === 0)) {
    return <p className="py-6 text-center text-sm text-muted">{t(locale, "progress.empty_strength")}</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / weeks.length;
  const barW = Math.max(slot - 4, 4);
  const yBase = H - PAD.bottom;
  const maxIdx = weeks.findIndex((w) => w.volumeKg === max);

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t(locale, "progress.volume_week")}>
        {weeks.map((w, i) => {
          const h = (w.volumeKg / max) * (yBase - PAD.top);
          const xPos = PAD.left + i * slot + (slot - barW) / 2;
          const showLabel = w.volumeKg > 0 && (w.isCurrent || i === maxIdx);
          return (
            <g key={w.label}>
              {w.volumeKg > 0 && (
                <path
                  d={barPath(xPos, yBase - h, barW, yBase, 4)}
                  fill={w.isCurrent ? "#5DD62C" : "rgba(93,214,44,0.35)"}
                />
              )}
              {showLabel && (
                <text
                  x={xPos + barW / 2}
                  y={yBase - h - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill={w.isCurrent ? "#5DD62C" : "rgba(248,248,248,0.6)"}
                >
                  {Math.round(w.volumeKg)}
                </text>
              )}
              {i % 2 === 0 && (
                <text
                  x={xPos + barW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize="7"
                  fill="rgba(248,248,248,0.45)"
                >
                  {w.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={yBase} y2={yBase} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>
    </div>
  );
}
