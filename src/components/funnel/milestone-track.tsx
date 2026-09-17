"use client";

import { Check, Flag, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, weeksLabel, type Locale } from "@/lib/i18n";
import type { Milestone } from "@/lib/funnel/projection";

/**
 * The journey as dated stops, not a line chart.
 *
 * A chart was the wrong instrument here. It needs two axes read at once, it
 * reduces to a smear at phone width, its most prominent feature is the
 * endpoint — the number furthest away and least believable — and in an RTL
 * layout the time axis has to run against the page to stay readable.
 *
 * A track fixes all four. Each stop is a date, a weight and a sentence, read
 * top to bottom like anything else on the screen. The first one sits at the
 * top, four weeks out, because that is the horizon a reader can picture. The
 * target is the destination rather than the headline.
 *
 * Nothing here is a different claim from the curve it replaced — same
 * simulation, same weeks, same numbers. It is the same truth told in the order
 * that makes somebody start.
 */
export function MilestoneTrack({
  locale,
  milestones,
  unitLabel,
}: {
  locale: Locale;
  milestones: Milestone[];
  /** "kg", localised — passed in so this file holds no unit vocabulary. */
  unitLabel: string;
}) {
  if (milestones.length < 2) return null;

  const start = milestones[0].kg;

  /**
   * Month and year, never a day.
   *
   * The arithmetic does not know which Tuesday. `-u-nu-latn` keeps the year in
   * Western digits, which is what this product does everywhere (globals.css).
   */
  const monthOf = (date: Date) =>
    date.toLocaleDateString(locale === "tn" ? "ar-TN-u-nu-latn" : "en-GB", {
      month: "long",
      year: "numeric",
    });

  return (
    <ol className="flex flex-col">
      {milestones.map((stop, index) => {
        const isLast = index === milestones.length - 1;
        const isTarget = stop.kind === "target";
        const isToday = stop.kind === "today";
        const delta = stop.kg - start;
        const Icon = isToday ? MapPin : isTarget ? Flag : Check;

        return (
          <li key={stop.week} className="flex gap-3.5">
            {/* The rail. A dot per stop, a line between them — drawn as part of
                the row so it cannot drift out of alignment with the text. */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  isTarget
                    ? "border-accent bg-accent text-bg"
                    : isToday
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-hairline bg-surface text-accent",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={isTarget ? 3 : 2.5} />
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className="w-0.5 flex-1 bg-gradient-to-b from-accent/50 to-accent/15"
                />
              )}
            </div>

            <div className={cn("flex min-w-0 flex-1 items-start justify-between gap-3", !isLast && "pb-5")}>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "font-display text-[15px] font-extrabold leading-tight",
                    isTarget ? "text-accent" : "text-ink",
                  )}
                >
                  {isToday
                    ? t(locale, "fn.r_today")
                    : isTarget
                      ? t(locale, "fn.r_target")
                      : `${stop.week} ${weeksLabel(locale, stop.week)}`}
                </span>
                <span className="text-[12px] text-muted">
                  {isToday ? t(locale, "fn.r_start_here") : monthOf(stop.date)}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end">
                <span
                  className={cn(
                    "font-display text-lg font-extrabold leading-tight tabular-nums",
                    isTarget ? "text-accent" : "text-ink",
                  )}
                >
                  <bdi>
                    {stop.kg.toFixed(1)} {unitLabel}
                  </bdi>
                </span>
                {/* The running difference, which is the number the reader is
                    actually here for. Absent on "today", where it is zero. */}
                {!isToday && Math.abs(delta) >= 0.1 && (
                  <span className="text-[12px] font-bold tabular-nums text-accent">
                    <bdi>
                      {delta < 0 ? "−" : "+"}
                      {Math.abs(delta).toFixed(1)} {unitLabel}
                    </bdi>
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
