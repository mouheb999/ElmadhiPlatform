"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

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
 * training (the brand), orange for food, cyan for protein — so the legend
 * beside the rings is read once and the rings are read at a glance after
 * that. The same three colours mark those three things everywhere else in the
 * app, which is what makes them a vocabulary rather than decoration.
 *
 * The rings fill from empty when the screen opens. It is the one entrance
 * animation on Today, and it is allowed because it carries information: you
 * watch your progress arrive rather than a box fading in. Everything else on
 * the screen is simply there. Reduced-motion users get the end state, through
 * the global transition rule in globals.css.
 *
 * The fill waits a frame after mount (`filled`) so the browser paints the
 * empty rings first; flipping it during the same frame would skip straight to
 * the end with nothing to transition from.
 *
 * With `href` the whole card is a link (to the weekly review). It used to be
 * reached only through a small "this week: 1/3" pill that the redesign
 * removed; tapping the rings to open their detail is where a native fitness
 * app puts that, and it keeps the review from being orphaned.
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
    { r: 52, colour: "var(--train)", p: ratio(training), delay: "0s" },
    { r: 38, colour: "var(--fuel)", p: ratio(food), delay: "0.1s" },
    { r: 24, colour: "var(--protein)", p: ratio(protein), delay: "0.2s" },
  ];

  const summary = [
    `${t(locale, "home.training")} ${training.value}/${training.target}`,
    `${t(locale, "home.food")} ${fmt.format(Math.round(food.value))}/${fmt.format(Math.round(food.target))} ${t(locale, "home.kcal")}`,
    `${t(locale, "home.protein")} ${Math.round(protein.value)}/${Math.round(protein.target)} ${t(locale, "home.g")}`,
  ].join(", ");

  const legend: { key: "home.training" | "home.food" | "home.protein"; colour: string; value: string; unit: string }[] = [
    {
      key: "home.training",
      colour: "text-train",
      value: `${training.value}/${training.target || "–"}`,
      unit: t(locale, "progress.sessions_label"),
    },
    {
      key: "home.food",
      colour: "text-fuel",
      value: fmt.format(Math.round(food.value)),
      unit: food.target > 0 ? `/${fmt.format(Math.round(food.target))} ${t(locale, "home.kcal")}` : t(locale, "home.kcal"),
    },
    {
      key: "home.protein",
      colour: "text-protein",
      value: String(Math.round(protein.value)),
      unit: protein.target > 0 ? `/${Math.round(protein.target)} ${t(locale, "home.g")}` : t(locale, "home.g"),
    },
  ];

  const body = (
    <>
      <svg width="124" height="124" viewBox="0 0 120 120" role="img" aria-label={summary} className="shrink-0">
        {rings.map((ring) => (
          <circle
            key={`track-${ring.r}`}
            cx="60"
            cy="60"
            r={ring.r}
            fill="none"
            stroke={ring.colour}
            strokeOpacity={0.18}
            strokeWidth={12}
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
              strokeWidth={12}
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

      <dl className="flex min-w-0 flex-1 flex-col gap-2.5">
        {legend.map((row) => (
          <div key={row.key}>
            <dt className={`text-[13px] font-semibold ${row.colour}`}>{t(locale, row.key)}</dt>
            <dd className="flex items-baseline gap-1">
              <span className="font-num text-[22px] font-bold leading-tight">{row.value}</span>
              <span className="truncate text-[13px] text-subtle">{row.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      {href && <ChevronRight className="h-5 w-5 shrink-0 self-center text-subtle rtl:rotate-180" aria-hidden />}
    </>
  );

  const frame = "flex items-center gap-5 rounded-card bg-surface px-5 py-[18px]";
  return href ? (
    <Link href={href} transitionTypes={["nav-forward"]} aria-label={summary} className={`press ${frame}`}>
      {body}
    </Link>
  ) : (
    <section aria-label={summary} className={frame}>
      {body}
    </section>
  );
}
