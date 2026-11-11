import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Check, Flag, Scale } from "lucide-react";
import { MilestoneTrack } from "@/components/funnel/milestone-track";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { journeyProgress, type Journey, type JourneyStatus } from "@/lib/journey";

const PLAN_WEEKS = 12;

/** A weigh-in older than this no longer says where they are. */
const STALE_AFTER_DAYS = 4;

const STATUS_COPY: Record<JourneyStatus, StringKey> = {
  on_track: "jr.on_track",
  ahead: "jr.ahead",
  behind: "jr.behind",
};

/**
 * The plan they signed up for, at the top of Progress — and the scale's answer
 * to it.
 *
 * /start ends on a timeline: a start, three dated stops and a weight at each.
 * It is why most people made an account, and it used to be shown exactly once.
 * It leads this page now, and it is wired to the weight logger, because a
 * forecast nobody checks against is a poster.
 *
 * **The bar is theirs, not the calendar's.** It fills with the share of the
 * twelve-week change the scale has actually delivered, so it moves when they
 * log a lower weight and stands still when they do not. A bar that fills with
 * the passing of days rewards somebody for owning the app. The plan's own pace
 * is a marker on the same bar, which turns "am I keeping up?" into something
 * that can be seen at a glance rather than worked out.
 *
 * **The headline is the kilos, not the week.** "−2.4 kg" is the sentence they
 * came for; "week 5 of 12" is context and sits above it in small type.
 *
 * **The stops tick when the scale reaches them.** See MilestoneTrack.
 *
 * **It asks for a weigh-in when it has none, or an old one.** Everything above
 * runs on that one number, so the card says so and links to where it is
 * logged, rather than showing a confident bar built on last week.
 *
 * The weights past the start stay ranges, exactly as on /start — same engine,
 * same honesty about what the arithmetic knows — and the forecast does not
 * bend to follow the scale. A target that moved every time they weighed in
 * would not be a target.
 */
export function JourneyCard({
  locale,
  journey,
  latestKg,
  daysSinceWeighIn,
}: {
  locale: Locale;
  journey: Journey;
  /** Their most recent weigh-in, or null if they have never logged one. */
  latestKg: number | null;
  /** Days since that weigh-in; 0 is today. Null when there is none. */
  daysSinceWeighIn: number | null;
}) {
  const { plan, elapsedWeeks, elapsedDays } = journey;
  const kg = t(locale, "fn.unit_kg");
  const scale = plan.kind === "scale";

  // "Week 1" on the first day, not "week 0": people count the week they are in.
  const weekNow = Math.min(PLAN_WEEKS, elapsedWeeks + 1);
  const timePercent = Math.min(100, Math.max(0, (elapsedDays / (PLAN_WEEKS * 7)) * 100));

  const progress = scale && latestKg !== null ? journeyProgress(journey, latestKg) : null;
  const stale = daysSinceWeighIn !== null && daysSinceWeighIn >= STALE_AFTER_DAYS;
  const needsWeighIn = scale && (latestKg === null || stale);

  const last = plan.timeline[plan.timeline.length - 1];
  const endRange =
    Math.round(last.lowKg) === Math.round(last.highKg)
      ? `~${Math.round(last.lowKg)}`
      : `~${Math.round(last.lowKg)}–${Math.round(last.highKg)}`;

  const signed = (value: number) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}`;
  // Has the scale moved the way the plan points, by enough to say so?
  const movingRight =
    progress !== null && progress.movedKg * Math.sign(progress.goalDeltaKg) >= 0.1;

  // What the bar is filled with: the scale when there is one, the calendar
  // when there is not. A sliver even at zero, so it reads as a bar.
  const fill = Math.max(3, progress ? progress.percent : timePercent);

  return (
    <section
      aria-label={t(locale, "jr.title")}
      className="relative flex flex-col gap-5 overflow-hidden rounded-[22px] border border-accent/45 bg-gradient-to-b from-accent/[0.14] via-surface to-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
          <Flag className="h-3.5 w-3.5" strokeWidth={2.6} />
          {t(locale, "jr.title")}
        </span>
        <span className="text-[12px] font-bold text-muted">
          {t(locale, "jr.week_of")
            .replace("{w}", String(weekNow))
            .replace("{n}", String(PLAN_WEEKS))}
        </span>
      </div>

      {/* ---- The headline ---- */}
      {progress ? (
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span
              className={`font-num text-[44px] font-bold leading-none ${
                movingRight ? "text-accent" : "text-ink"
              }`}
            >
              <bdi>
                {/* The sign belongs in front of the figure in Arabic too. */}
                <span dir="ltr">{signed(progress.movedKg)}</span>{" "}
                <span className="text-[20px]">{kg}</span>
              </bdi>
            </span>
            <span className="text-[14px] font-semibold text-muted">
              {t(locale, "jr.of_goal")}{" "}
              <bdi className="text-ink">
                <span dir="ltr">{signed(progress.goalDeltaKg)}</span> {kg}
              </bdi>
            </span>
          </div>
          <StatusChip locale={locale} status={progress.status} gapKg={progress.gapKg} unit={kg} />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="font-num text-[44px] font-bold leading-none text-ink">{weekNow}</span>
            <span className="text-[15px] font-bold text-muted">
              {t(locale, "jr.of_weeks").replace("{n}", String(PLAN_WEEKS))}
            </span>
          </span>
          {scale && (
            <span className="flex flex-col items-end text-end">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                {t(locale, "jr.heading_to")}
              </span>
              <span className="font-num text-[22px] font-bold leading-tight text-accent">
                <bdi>
                  {endRange} {kg}
                </bdi>
              </span>
            </span>
          )}
        </div>
      )}

      {/* ---- The bar ----
          Filled by the scale. The white marker is where the plan expected them
          to be today, so the gap between the two is the whole story. */}
      <div className="flex flex-col gap-2">
        <div className="relative h-3 rounded-full bg-white/10">
          <div
            className="bar-grow h-full rounded-full bg-accent shadow-[0_0_16px_rgba(168,255,0,0.6)]"
            style={{ width: `${fill}%` }}
          />
          {progress && (
            <span
              aria-hidden
              className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
              style={{ insetInlineStart: `calc(${progress.planPercent}% - 1.5px)` }}
            />
          )}
        </div>
        {scale && (
          <div className="flex items-center justify-between text-[12px] font-semibold text-muted">
            <bdi>
              {journey.startKg.toFixed(1)} {kg}
            </bdi>
            {progress && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-3 w-[3px] rounded-full bg-ink" />
                {t(locale, "jr.plan_today")}{" "}
                <bdi className="text-ink">
                  {progress.expectedKg.toFixed(1)} {kg}
                </bdi>
              </span>
            )}
            <bdi className="text-accent">
              {endRange} {kg}
            </bdi>
          </div>
        )}
      </div>

      {/* ---- The weigh-in this all runs on ---- */}
      {needsWeighIn && (
        <Link
          href="/dashboard#checkin"
          className="press flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3 text-bg"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-extrabold leading-snug">
              {t(locale, "jr.log_weight")}
            </span>
            <span className="text-[12.5px] font-semibold leading-snug opacity-75">
              {latestKg === null
                ? t(locale, "jr.log_first")
                : t(locale, "jr.log_stale").replace("{n}", String(daysSinceWeighIn))}
            </span>
          </span>
          <Scale className="h-6 w-6 shrink-0" strokeWidth={2.4} />
        </Link>
      )}

      {scale ? (
        <MilestoneTrack
          locale={locale}
          milestones={plan.timeline}
          unitLabel={kg}
          targetWeek={plan.targetWithinTimeline ? plan.targetWeeks : null}
          elapsedWeeks={elapsedWeeks}
          currentKg={latestKg}
          direction={plan.direction}
        />
      ) : (
        // Maintenance or recomposition: the scale is not the measure, so there
        // is no weight track to draw. The weeks still count.
        <p className="text-[14px] leading-snug text-muted">{t(locale, "jr.recomp")}</p>
      )}
    </section>
  );
}

/**
 * The comparison in a word. Lime when they are with the plan or past it;
 * plain, not red, when they are behind — it is a gap to close, not a failure,
 * and the wording says how big it is.
 */
function StatusChip({
  locale,
  status,
  gapKg,
  unit,
}: {
  locale: Locale;
  status: JourneyStatus;
  gapKg: number;
  unit: string;
}) {
  const good = status !== "behind";
  const Icon = status === "on_track" ? Check : status === "ahead" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${
        good ? "bg-accent text-bg" : "bg-white/10 text-ink"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.8} />
      <span>
        {t(locale, STATUS_COPY[status])}
        {status !== "on_track" && (
          <>
            {" "}
            <bdi>
              {gapKg.toFixed(1)} {unit}
            </bdi>
          </>
        )}
      </span>
    </span>
  );
}
