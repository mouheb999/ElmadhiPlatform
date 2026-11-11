"use client";

import { Check, Flag, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, weeksLabel, type Locale } from "@/lib/i18n";
import type { TimelinePoint } from "@/lib/funnel/fitness-plan";
import { stopReached } from "@/lib/journey";

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
 *
 * Every weight past today is printed as a range, not a figure. The arithmetic
 * behind it is an estimate and it loosens the further out it runs, so "~69–71
 * kg in twelve weeks" is what it actually knows; "69.8 kg" was precision the
 * inputs never had. Today is the one exact number on the track, because it is
 * the only one the reader typed in themselves.
 */
export function MilestoneTrack({
  locale,
  milestones,
  unitLabel,
  /** The stop where the weight they typed is reached, if it is on the track. */
  targetWeek,
  elapsedWeeks,
  currentKg,
  direction = "down",
}: {
  locale: Locale;
  milestones: TimelinePoint[];
  /** "kg", localised — passed in so this file holds no unit vocabulary. */
  unitLabel: string;
  targetWeek?: number | null;
  /**
   * Whole weeks since the plan started, when this is read back inside the app.
   *
   * Leave it out on /start, where every stop is in the future and the first
   * row is "today". Given, the track becomes a record as well as a forecast:
   * the first row is the day they started, the stops already behind them are
   * filled in, and the one they are walking towards is marked as next.
   */
  elapsedWeeks?: number;
  /**
   * Their latest weigh-in, in the app. When there is one, a stop is ticked
   * because the scale reached it, not because its date went by: a milestone
   * that fills itself in for somebody who has not moved is not a milestone.
   * Without one the track falls back to the calendar, which is all it knows.
   */
  currentKg?: number | null;
  /** Which way the plan moves the scale. Decides what "reached" means. */
  direction?: "down" | "up" | "hold";
}) {
  if (milestones.length < 2) return null;

  const start = milestones[0].kg;
  const inApp = elapsedWeeks !== undefined;
  const byScale = inApp && currentKg != null;
  const reached = (stop: TimelinePoint): boolean =>
    byScale ? stopReached(stop, currentKg, direction) : inApp && stop.week <= elapsedWeeks;
  const nextWeek = inApp ? (milestones.find((stop) => !reached(stop))?.week ?? null) : null;

  /**
   * One decimal reads as a measurement; none reads as an estimate, which is
   * what this is. A range whose ends round to the same whole number collapses
   * to "~70 kg" rather than printing "~70–70 kg".
   */
  const range = (stop: TimelinePoint): string => {
    const low = Math.round(stop.lowKg);
    const high = Math.round(stop.highKg);
    return low === high ? `~${low}` : `~${low}–${high}`;
  };

  /**
   * The day and the month — an exact date, because that is what this is.
   *
   * Month-only was right when these stops were wherever a simulation happened
   * to land. They are fixed horizons now, 28 days apart, and a date 28 days out
   * is not an estimate: the WEIGHT is the estimate, which is why it is the
   * weight that prints as a range. Month-only also had a failure mode that looks
   * exactly like the bug this rewrite is fixing — two stops 28 days apart can
   * fall in the same calendar month (1 March and 29 March), so two different
   * dates rendered as one repeated label.
   *
   * `-u-nu-latn` keeps the digits Western, which is what this product does
   * everywhere (globals.css).
   */
  const dayOf = (date: Date) =>
    date.toLocaleDateString(locale === "tn" ? "ar-TN-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
    });

  return (
    <ol className="flex flex-col">
      {milestones.map((stop, index) => {
        const isLast = index === milestones.length - 1;
        const isToday = stop.week === 0;
        const isTarget = targetWeek != null && stop.week === targetWeek;
        const delta = stop.kg - start;
        const isPassed = inApp && reached(stop);
        const isNext = inApp && stop.week === nextWeek;
        const isAhead = inApp && !isPassed && !isNext;
        const Icon = isToday ? MapPin : isTarget ? Flag : Check;

        return (
          <li key={stop.week} className="flex gap-3.5">
            {/* The rail. A dot per stop, a line between them — drawn as part of
                the row so it cannot drift out of alignment with the text. */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  inApp
                    ? isPassed
                      ? "border-accent bg-accent text-bg"
                      : isNext
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/15 bg-transparent text-white/30"
                    : isTarget
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
                  className={cn(
                    "w-0.5 flex-1",
                    inApp
                      ? isPassed
                        ? "bg-accent/70"
                        : "bg-white/10"
                      : "bg-gradient-to-b from-accent/50 to-accent/15",
                  )}
                />
              )}
            </div>

            <div className={cn("flex min-w-0 flex-1 items-start justify-between gap-3", !isLast && "pb-5")}>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "font-display text-[15px] font-extrabold leading-tight",
                    isAhead ? "text-muted" : isTarget && !inApp ? "text-accent" : "text-ink",
                  )}
                >
                  {isToday
                    ? t(locale, inApp ? "jr.start" : "fn.r_today")
                    : `${stop.week} ${weeksLabel(locale, stop.week)}`}
                  {isNext && (
                    <span className="ms-2 rounded-full bg-accent px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-bg">
                      {t(locale, "jr.next")}
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-muted">
                  {isToday && !inApp ? t(locale, "fn.r_start_here") : dayOf(stop.date)}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end">
                <span
                  className={cn(
                    "font-display text-lg font-extrabold leading-tight tabular-nums",
                    isAhead ? "text-muted" : isTarget && !inApp ? "text-accent" : "text-ink",
                  )}
                >
                  <bdi>
                    {isToday ? stop.kg.toFixed(1) : range(stop)} {unitLabel}
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
                {/* Said on the stop that reaches it, rather than by relabelling
                    the row — the horizons are fixed at 4/8/12 weeks now, so the
                    target is something a stop passes, not a stop of its own. */}
                {isTarget && (
                  <span className="text-[11px] font-bold text-accent">
                    {t(locale, "fn.r_target")}
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
