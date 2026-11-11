import { Flag } from "lucide-react";
import { MilestoneTrack } from "@/components/funnel/milestone-track";
import { t, type Locale } from "@/lib/i18n";
import type { Journey } from "@/lib/journey";

const PLAN_WEEKS = 12;

/**
 * The plan they signed up for, at the top of Progress.
 *
 * Everything else on this screen answers "what have I done": sessions, sets,
 * kilos lifted. None of it answers the question the member actually arrived
 * with, which is "am I getting where I said I wanted to go, and when". That
 * answer was computed for them on /start and then thrown away at sign-up.
 *
 * So it leads the page, and it is the one card here that is allowed to be
 * loud: a lime frame, the week they are in as the headline, a bar that fills
 * as the twelve weeks pass, and the four dated stops underneath with the ones
 * behind them ticked off. It is a destination with a date on it, and a date is
 * a reason to open the app tomorrow.
 *
 * The weights past the start are ranges, exactly as on /start — same engine,
 * same honesty about what the arithmetic knows. What is new is the member's
 * own latest weigh-in beside it, when there is one: the forecast was always
 * going to be judged against the scale, and it is better judged here, next to
 * the number it promised, than in the member's head.
 */
export function JourneyCard({
  locale,
  journey,
  latestKg,
}: {
  locale: Locale;
  journey: Journey;
  /** Their most recent weigh-in, or null if they have never checked in. */
  latestKg: number | null;
}) {
  const { plan, elapsedWeeks, elapsedDays } = journey;
  const kg = t(locale, "fn.unit_kg");
  const scale = plan.kind === "scale";

  // "Week 1" on the first day, not "week 0": people count the week they are in.
  const weekNow = Math.min(PLAN_WEEKS, elapsedWeeks + 1);
  const finished = elapsedWeeks >= PLAN_WEEKS;
  const filled = Math.min(100, Math.max(3, (elapsedDays / (PLAN_WEEKS * 7)) * 100));

  const last = plan.timeline[plan.timeline.length - 1];
  const endRange =
    Math.round(last.lowKg) === Math.round(last.highKg)
      ? `~${Math.round(last.lowKg)}`
      : `~${Math.round(last.lowKg)}–${Math.round(last.highKg)}`;

  const moved = latestKg !== null ? latestKg - journey.startKg : null;

  return (
    <section
      aria-label={t(locale, "jr.title")}
      className="relative flex flex-col gap-5 overflow-hidden rounded-[22px] border border-accent/45 bg-gradient-to-b from-accent/[0.14] via-surface to-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
            <Flag className="h-3.5 w-3.5" strokeWidth={2.6} />
            {t(locale, "jr.title")}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-num text-[40px] font-bold leading-none text-ink">
              {finished ? PLAN_WEEKS : weekNow}
            </span>
            <span className="text-[15px] font-bold text-muted">
              {t(locale, "jr.of_weeks").replace("{n}", String(PLAN_WEEKS))}
            </span>
          </span>
        </div>

        {/* The destination, opposite the week: where this is going. */}
        {scale && (
          <div className="flex flex-col items-end gap-0.5 text-end">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              {t(locale, "jr.heading_to")}
            </span>
            <span className="font-num text-[22px] font-bold leading-tight text-accent">
              <bdi>
                {endRange} {kg}
              </bdi>
            </span>
          </div>
        )}
      </div>

      {/* Twelve weeks as one bar. The three ticks are the stops below. */}
      <div className="relative h-2.5 rounded-full bg-white/10" aria-hidden>
        <div
          className="h-full rounded-full bg-accent shadow-[0_0_14px_rgba(168,255,0,0.55)]"
          style={{ width: `${filled}%` }}
        />
        {[4, 8].map((week) => (
          <span
            key={week}
            className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-bg/70"
            style={{ insetInlineStart: `${(week / PLAN_WEEKS) * 100}%` }}
          />
        ))}
      </div>

      {/* Their own number against the plan's, when they have weighed in. */}
      {scale && latestKg !== null && moved !== null && (
        <p className="-mt-1 text-[14px] leading-snug text-muted">
          {t(locale, "jr.you_now")}{" "}
          <bdi className="font-bold text-ink">
            {latestKg.toFixed(1)} {kg}
          </bdi>
          {Math.abs(moved) >= 0.1 && (
            <>
              {" · "}
              <bdi className="font-bold text-accent">
                {moved < 0 ? "−" : "+"}
                {Math.abs(moved).toFixed(1)} {kg}
              </bdi>{" "}
              {t(locale, "jr.since_start")}
            </>
          )}
        </p>
      )}

      {scale ? (
        <MilestoneTrack
          locale={locale}
          milestones={plan.timeline}
          unitLabel={kg}
          targetWeek={plan.targetWithinTimeline ? plan.targetWeeks : null}
          elapsedWeeks={elapsedWeeks}
        />
      ) : (
        // Maintenance or recomposition: the scale is not the measure, so there
        // is no weight track to draw. The weeks still count.
        <p className="text-[14px] leading-snug text-muted">{t(locale, "jr.recomp")}</p>
      )}
    </section>
  );
}
