"use client";

import { useEffect, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { CardTitleRow } from "@/components/shared/card-title-row";

type Metric = { value: number; target: number };

const fmt = new Intl.NumberFormat("en-US");

function ratio({ value, target }: Metric): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(value / target, 1));
}

/**
 * Three rings that close as the day fills in: training, food, protein.
 *
 * The one place on Today where colour carries meaning on its own — lime for
 * training (the brand), orange for food, cyan for protein — so the legend is
 * read once and the rings at a glance after that. The same three colours mark
 * those three things everywhere else in the app.
 *
 * The legend is set the way native activity summaries set it: a white label,
 * then the figure in the ring's colour with its unit in small capitals of the
 * same colour ("1,110/2,350 KCAL"). Colour on the number itself, not on a dot
 * beside it, is most of what makes a summary card read as premium.
 *
 * The rings fill from empty when the screen opens — the one entrance animation
 * on Today, allowed because what animates is your progress arriving. The fill
 * waits a frame after mount so the empty state is painted first; flipping it
 * in the same frame would skip straight to the end. Reduced-motion users get
 * the end state, through the global transition rule in globals.css.
 *
 * With `href`, the title row's chevron opens the weekly review — its only
 * entry point since the old "this week" pill went.
 */
export function TodayRings({
  locale,
  training,
  food,
  protein,
  href,
}: {
  locale: Locale;
  href?: string;
  /** Sessions done this week vs. the program's days per week. */
  training: Metric;
  /** kcal eaten today vs. the plan's target. */
  food: Metric;
  /** Protein grams today vs. target. */
  protein: Metric;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const rings = [
    { r: 53, colour: "var(--train)", p: ratio(training), delay: "0s" },
    { r: 38, colour: "var(--fuel)", p: ratio(food), delay: "0.1s" },
    { r: 23, colour: "var(--protein)", p: ratio(protein), delay: "0.2s" },
  ];

  const pair = (m: Metric, f: (n: number) => string) => (m.target > 0 ? `${f(m.value)}/${f(m.target)}` : f(m.value));
  const kcal = (n: number) => fmt.format(Math.round(n));
  const whole = (n: number) => String(Math.round(n));

  const legend = [
    {
      label: t(locale, "home.training"),
      colour: "text-train",
      value: pair(training, whole),
      unit: t(locale, "progress.sessions_label"),
    },
    { label: t(locale, "home.food"), colour: "text-fuel", value: pair(food, kcal), unit: t(locale, "home.kcal") },
    { label: t(locale, "home.protein"), colour: "text-protein", value: pair(protein, whole), unit: t(locale, "home.g") },
  ];

  const summary = legend.map((row) => `${row.label} ${row.value} ${row.unit}`).join(", ");

  return (
    <section aria-label={summary} className="card-surface flex flex-col gap-4 p-5">
      <CardTitleRow title={t(locale, "home.activity")} href={href} transitionType="nav-forward" />

      <div className="flex items-center gap-[18px]">
        <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={summary} className="shrink-0">
          {rings.map((ring) => (
            <circle
              key={`track-${ring.r}`}
              cx="60"
              cy="60"
              r={ring.r}
              fill="none"
              stroke={ring.colour}
              strokeOpacity={0.2}
              strokeWidth={13}
            />
          ))}
          {rings.map((ring) => {
            const c = 2 * Math.PI * ring.r;
            return (
              <circle
                key={`ring-${ring.r}`}
                cx="60"
                cy="60"
                r={ring.r}
                fill="none"
                stroke={ring.colour}
                strokeWidth={13}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                style={{
                  strokeDasharray: c,
                  strokeDashoffset: filled ? c * (1 - ring.p) : c,
                  transition: `stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1) ${ring.delay}`,
                  // A ring at 0 would still draw its round cap as a dot.
                  opacity: ring.p > 0 ? 1 : 0,
                }}
              />
            );
          })}
        </svg>

        <dl className="flex min-w-0 flex-1 flex-col gap-2">
          {legend.map((row) => (
            <div key={row.label}>
              <dt className="text-[15px] font-semibold leading-tight text-ink">{row.label}</dt>
              <dd className={`flex flex-wrap items-baseline gap-x-1 ${row.colour}`}>
                <span className="font-num text-[22px] font-bold leading-tight">{row.value}</span>
                <span className="text-[13px] font-bold uppercase">{row.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
