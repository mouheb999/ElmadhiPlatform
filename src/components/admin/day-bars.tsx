"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DayBar = { date: string; count: number };

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/** "2026-11-15" (already a Tunis day) → "15 Nov". */
export function formatDayKey(key: string): string {
  return dayFmt.format(new Date(`${key}T00:00:00Z`));
}

/**
 * One value per day as thin bars. A single series, so no legend — the
 * caller's heading names it. Hover, focus or tap a bar for its exact value;
 * a visually hidden table carries the same numbers for screen readers.
 *
 * Bare on purpose (no card of its own) so it can sit inside a hero as well as
 * in a section.
 */
export function DayBars({
  daily,
  caption,
  valueTemplate,
  heightClass = "h-36",
  barClass = "bg-accent",
}: {
  daily: DayBar[];
  /** Names the series for assistive tech. */
  caption: string;
  /**
   * How one day's value is worded, with `{n}` for the number — "{n} DT".
   * A string rather than a function so a Server Component can pass it.
   */
  valueTemplate: string;
  heightClass?: string;
  barClass?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (daily.length === 0) return null;
  const formatValue = (n: number) =>
    valueTemplate.replace("{n}", Math.round(n).toLocaleString("en-US"));

  const max = Math.max(1, ...daily.map((d) => d.count));
  const shown = hover !== null ? daily[hover] : null;
  // A handful of date ticks, never one per bar: first, last, and one between.
  const ticks = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);

  return (
    <div className="flex flex-col gap-2">
      <p className="h-4 text-end text-xs tabular-nums text-muted" dir="ltr" aria-live="polite">
        {shown ? `${formatDayKey(shown.date)} · ${formatValue(shown.count)}` : `max ${formatValue(max)}`}
      </p>

      <div className={cn("relative", heightClass)} dir="ltr">
        {/* Recessive guides: the top of the scale and the baseline. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-hairline" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-hairline" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {daily.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${formatDayKey(d.date)}: ${formatValue(d.count)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              // The hit target is the full column, not just the bar.
              className="group flex h-full min-w-0 flex-1 cursor-pointer items-end focus:outline-none"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-opacity duration-150",
                  d.count === 0 ? "bg-white/10" : barClass,
                  hover !== null && hover !== i ? "opacity-50" : "opacity-100",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ink",
                )}
                style={{ height: d.count === 0 ? 2 : `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-[2px] text-[10px] tabular-nums text-muted" dir="ltr">
        {daily.map((d, i) => (
          <span
            key={d.date}
            // The end labels hug their edge so they never run off the card.
            className={cn(
              "min-w-0 flex-1 overflow-visible whitespace-nowrap",
              i === 0 ? "text-left" : i === daily.length - 1 ? "flex justify-end" : "text-center",
            )}
          >
            {ticks.has(i) ? formatDayKey(d.date) : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{formatValue(d.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
