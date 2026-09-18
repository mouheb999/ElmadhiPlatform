"use client";

import { CalendarDays, Check, Dumbbell, Flame, Info, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { MilestoneTrack } from "@/components/funnel/milestone-track";
import { ProofPoints, Testimonials } from "@/components/funnel/proof";
import { t, weeksLabel, type Locale, type StringKey } from "@/lib/i18n";
import type { FunnelAnswers } from "@/lib/funnel/answers";
import { calculateFitnessPlan } from "@/lib/funnel/fitness-plan";

/**
 * The payoff.
 *
 * Everything on this screen is computed from the eleven answers behind it, by
 * the same `calculateMacros` the paid product builds real plans with. That is
 * the point and it is worth being strict about: a reveal that showed rounded
 * marketing numbers and then handed over a different plan after payment would
 * be the one lie that unravels the whole funnel, and it would unravel it in
 * week one, in public, to the first customer who compared the two.
 *
 * So the calories here are the calories they get. The curve is the plan's own
 * week-by-week arithmetic. The date is where that curve crosses the number
 * they typed, and when it does not cross inside two years the screen says so
 * instead of picking a date.
 */

/** How many sessions a week each training-days answer means, for display. */
const DAYS_LABEL: Record<string, StringKey> = {
  "0": "diet.td_0",
  "1_2": "diet.td_1_2",
  "3_4": "diet.td_3_4",
  "5_6": "diet.td_5_6",
  "7": "diet.td_7",
};

export function PlanReveal({
  locale,
  answers,
  onContinue,
}: {
  locale: Locale;
  answers: FunnelAnswers;
  onContinue: () => void;
}) {
  const projection = calculateFitnessPlan(answers);
  const { targets } = projection;
  const rateKg = Math.abs(projection.weeklyRateKg);
  const last = projection.timeline[projection.timeline.length - 1];

  /**
   * Month and year, not a day.
   *
   * A projection accurate to the calendar day would be a claim the arithmetic
   * cannot support; "by March 2026" is the granularity this actually knows.
   * The `-u-nu-latn` is not decoration either — Intl renders Arabic dates in
   * Arabic-Indic digits by default, and this product pins Western numerals
   * everywhere (see globals.css) so 2026 does not become ٢٠٢٦ on one screen.
   */
  const dateLabel = projection.targetDate
    ? projection.targetDate.toLocaleDateString(locale === "tn" ? "ar-TN-u-nu-latn" : "en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15">
          <Check className="h-6 w-6 text-accent" strokeWidth={3} />
        </span>
        <h1 className="text-balance font-display text-[28px] font-extrabold leading-tight tracking-tight">
          {t(locale, "fn.r_title")}
        </h1>
        <p className="max-w-[34ch] text-balance text-sm leading-relaxed text-muted">
          {t(locale, "fn.r_sub")}
        </p>
      </header>

      {/* ---- The daily number ---- */}
      <section className="flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent/5 px-5 py-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-accent">
          <Flame className="h-4 w-4" />
          {t(locale, "fn.r_daily")}
        </div>

        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-[52px] font-extrabold leading-none tabular-nums">
            {targets.calories}
          </span>
          <span className="text-sm font-bold text-muted">{t(locale, "fn.m_kcal")}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Macro label={t(locale, "fn.m_protein")} grams={targets.proteinG} />
          <Macro label={t(locale, "fn.m_carbs")} grams={targets.carbsG} />
          <Macro label={t(locale, "fn.m_fat")} grams={targets.fatG} />
        </div>

        <p className="text-center text-xs text-muted">
          {t(locale, "fn.r_maintenance")}:{" "}
          <bdi className="font-bold tabular-nums text-ink">
            {targets.tdee} {t(locale, "fn.m_kcal")}
          </bdi>
        </p>
      </section>

      {/* ---- Your goal, and the pace it implies ---- */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-surface px-4 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {t(locale, "fn.r_goal_label")}
          </span>
          <span className="font-display text-[15px] font-extrabold leading-tight">
            {locale === "tn" ? targets.goalLabel.ar : targets.goalLabel.en}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-surface px-4 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {t(locale, "fn.r_pace_label")}
          </span>
          <span className="flex items-center gap-1.5 font-display text-[15px] font-extrabold leading-tight">
            {projection.direction === "down" ? (
              <TrendingDown className="h-4 w-4 shrink-0 text-accent" />
            ) : projection.direction === "up" ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
            ) : null}
            {/* The rate and the calories above are the same decision read two
                ways — see lib/algorithms/energy.ts. They cannot disagree. */}
            <bdi>
              {projection.direction === "hold"
                ? t(locale, "fn.r_pace_hold")
                : `~${rateKg.toFixed(2)} ${t(locale, "fn.unit_kg")}${t(locale, "fn.r_per_week")}`}
            </bdi>
          </span>
        </div>
      </section>

      {/* ---- Where it goes ---- */}
      {projection.kind === "scale" ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface px-4 py-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-extrabold">{t(locale, "fn.r_chart_title")}</h2>
            {/* The twelve-week headline, as a range. Leading with a single
                figure would be precision the arithmetic has not got; the band
                is what it actually knows, and it is still a number worth
                reading. */}
            <p className="text-[13px] leading-relaxed text-muted">
              {t(locale, "fn.r_twelve_line")}{" "}
              <bdi className="font-bold text-ink">
                {answers.weightKg.toFixed(1)} {t(locale, "fn.unit_kg")}
              </bdi>{" "}
              →{" "}
              <bdi className="font-bold text-accent">
                {Math.round(last.lowKg) === Math.round(last.highKg)
                  ? `~${Math.round(last.lowKg)}`
                  : `~${Math.round(last.lowKg)}–${Math.round(last.highKg)}`}{" "}
                {t(locale, "fn.unit_kg")}
              </bdi>
            </p>
          </div>

          <MilestoneTrack
            locale={locale}
            milestones={projection.timeline}
            unitLabel={t(locale, "fn.unit_kg")}
            targetWeek={projection.targetWithinTimeline ? projection.targetWeeks : null}
          />

          {/* Their typed target, when it lands past the twelve weeks on screen.
              Kept as a destination rather than the headline: it is the number
              furthest away and the easiest to disbelieve. */}
          {projection.targetWeeks !== null && !projection.targetWithinTimeline && dateLabel && (
            <p className="flex items-center justify-center gap-1.5 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <bdi>
                {t(locale, "fn.r_by")} {dateLabel} · {projection.targetWeeks}{" "}
                {weeksLabel(locale, projection.targetWeeks)}
              </bdi>
            </p>
          )}

          {/* The goal and the target weight point opposite ways — "build
              muscle" with a lower target, say. The plan follows the goal, and
              says so, rather than drawing the flat line the old code drew. */}
          {projection.targetContradictsGoal && (
            <p className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{t(locale, "fn.r_goal_conflict")}</span>
            </p>
          )}

          <p className="text-center text-[12px] leading-relaxed text-muted">
            {t(locale, "fn.r_estimate")}
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface px-4 py-5 text-center">
          <h2 className="font-display text-base font-extrabold">
            {t(locale, projection.guidance ? "fn.r_care_title" : "fn.r_recomp_title")}
          </h2>
          <p className="text-[13px] leading-relaxed text-muted">
            {t(
              locale,
              projection.guidance === "minor"
                ? "fn.r_care_minor"
                : projection.guidance === "underweight"
                  ? "fn.r_care_underweight"
                  : "fn.r_recomp_body",
            )}
          </p>
        </section>
      )}

      {/* ---- The week ---- */}
      <section className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15">
          <Dumbbell className="h-5 w-5 text-accent" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[15px] font-extrabold">
            {t(locale, "fn.r_week_title")} ·{" "}
            <bdi>{t(locale, DAYS_LABEL[answers.trainingDays] ?? "diet.td_3_4")}</bdi>
          </span>
          <span className="text-[13px] leading-snug text-muted">{t(locale, "fn.r_week_body")}</span>
        </span>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-center font-display text-lg font-extrabold tracking-tight">
          {t(locale, "fn.r_inside")}
        </h2>
        <ProofPoints locale={locale} />
      </section>

      <Testimonials locale={locale} limit={2} />

      <p className="text-center text-[11.5px] leading-relaxed text-muted">
        {t(locale, "fn.r_kept")}
      </p>

      {/* ---- The ask ----

          Last in the DOM on purpose. It is sticky, so it rides the bottom of
          the screen for the whole scroll — and anything after it in source
          order would paint straight over it. */}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-5 pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent font-display text-base font-bold text-bg shadow-[0_12px_32px_-8px_rgba(192,218,27,0.5)] transition-transform active:scale-[0.98]"
        >
          <Lock className="h-[18px] w-[18px]" />
          {t(locale, "fn.r_cta")}
        </button>
        <p className="text-center text-[11.5px] text-muted">{t(locale, "fn.r_cta_sub")}</p>
      </div>
    </div>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-bg/40 py-2.5">
      <span className="font-display text-lg font-extrabold tabular-nums">
        <bdi>{grams} g</bdi>
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}
