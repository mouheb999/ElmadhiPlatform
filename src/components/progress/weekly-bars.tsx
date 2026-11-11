export type WeekBar = {
  /** Short date of the week's Monday, e.g. "6 Oct". */
  label: string;
  value: number;
};

const W = 320;
const H = 156;
const PAD = { top: 24, right: 4, bottom: 24, left: 4 };

/** Rounded-top bar anchored flat on the baseline. */
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

/**
 * Twelve weeks as bars, oldest on the left, this week on the right.
 *
 * Built to be read without a legend:
 *   - a bar is solid when it counts (the week met the goal, or it is this
 *     week) and faint when it does not, so good weeks stand out at a glance;
 *   - with a `target`, a dashed line marks the goal and says so in words;
 *   - the figure that matters is written above its bar instead of being left
 *     to a y-axis nobody reads — every bar for small counts like sessions,
 *     only this week and the best week for large numbers like kilos;
 *   - four dates along the bottom, the last one reading "Now".
 *
 * The time axis runs left to right in Arabic too, as charts do in print.
 */
export function WeeklyBars({
  weeks,
  colour,
  target,
  targetLabel,
  nowLabel,
  labelAll,
  format = (n) => String(n),
  ariaLabel,
}: {
  weeks: WeekBar[];
  /** A CSS colour, normally one of the domain variables. */
  colour: string;
  /** Draws the goal line and dims the weeks that fell short of it. */
  target?: number;
  targetLabel?: string;
  nowLabel: string;
  /** Write every bar's value, not just this week's and the best. */
  labelAll?: boolean;
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const values = weeks.map((w) => w.value);
  const max = Math.max(...values, target ?? 0, 1);
  const hasGoal = target !== undefined && target > 0;
  // With a goal, the bars start after a short gutter that holds the goal's
  // label beside its line, so it never sits on top of a bar or its number.
  const left = hasGoal ? 44 : PAD.left;
  const innerW = W - left - PAD.right;
  const slot = innerW / weeks.length;
  const barW = Math.min(18, slot - 6);
  const yBase = H - PAD.bottom;
  const y = (v: number) => yBase - (v / max) * (yBase - PAD.top);
  const last = weeks.length - 1;
  const best = values.indexOf(Math.max(...values));

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
        <line x1={left} x2={W - PAD.right} y1={yBase} y2={yBase} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {weeks.map((w, i) => {
          const x = left + i * slot + (slot - barW) / 2;
          const counts = target !== undefined ? w.value >= target : i === last;
          const showValue = w.value > 0 && (labelAll || i === last || i === best);
          // Small counts are written inside the top of their bar, where the
          // goal line cannot run through them; big numbers sit above.
          const inside = labelAll && yBase - y(w.value) >= 20;
          return (
            <g key={`${w.label}-${i}`}>
              {/* An empty week still gets a stub, so "nothing" reads as a
                  week that happened rather than a gap in the data. */}
              <path
                d={barPath(x, w.value > 0 ? y(w.value) : yBase - 3, barW, yBase, 5)}
                fill={colour}
                fillOpacity={w.value === 0 ? 0.16 : counts ? 1 : 0.38}
              />
              {showValue && (
                <text
                  x={x + barW / 2}
                  y={inside ? y(w.value) + 14 : y(w.value) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={inside ? (counts ? "#000000" : "rgba(255,255,255,0.85)") : counts ? colour : "rgba(255,255,255,0.6)"}
                  style={{ fontFamily: "var(--font-num)" }}
                >
                  {format(w.value)}
                </text>
              )}
              {(i % 4 === 0 || i === last) && (
                <text
                  x={i === last ? W - PAD.right : x + barW / 2}
                  y={H - 6}
                  textAnchor={i === last ? "end" : "middle"}
                  fontSize="10.5"
                  fontWeight={i === last ? "700" : "500"}
                  fill={i === last ? "#ffffff" : "rgba(255,255,255,0.5)"}
                >
                  {i === last ? nowLabel : w.label}
                </text>
              )}
            </g>
          );
        })}

        {hasGoal && (
          <g>
            <line
              x1={left - 4}
              x2={W - PAD.right}
              y1={y(target)}
              y2={y(target)}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.25"
              strokeDasharray="4 4"
            />
            <text x={0} y={y(target) - 3} fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.6)">
              {targetLabel}
            </text>
            <text
              x={0}
              y={y(target) + 11}
              fontSize="12"
              fontWeight="700"
              fill="#ffffff"
              style={{ fontFamily: "var(--font-num)" }}
            >
              {target}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
