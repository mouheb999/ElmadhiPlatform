"use client";

import Link from "next/link";
import { Flame, Sparkles, Target } from "lucide-react";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { isComplete, type FunnelAnswers } from "@/lib/funnel/answers";
import { projectWeight } from "@/lib/funnel/projection";

/**
 * The plan they built on /start, restated at the top of checkout.
 *
 * Checkout's job is to be the next step in something already decided, not a
 * price list somebody has been dropped on. Two minutes ago this reader watched
 * a plan get built out of their own numbers; opening on a grid of terms with
 * no mention of it makes them re-decide from scratch.
 *
 * So: their calories, their week, their target, and one sentence saying it
 * unlocks when the subscription is confirmed. The numbers are recomputed from
 * the same engine that produced them on /start, so the two screens cannot
 * drift apart.
 */

const DAYS_LABEL: Record<string, StringKey> = {
  "0": "diet.td_0",
  "1_2": "diet.td_1_2",
  "3_4": "diet.td_3_4",
  "5_6": "diet.td_5_6",
  "7": "diet.td_7",
};

export function PlanRecap({
  locale,
  answers,
}: {
  locale: Locale;
  answers: Partial<FunnelAnswers>;
}) {
  if (!isComplete(answers)) return null;
  const { targets } = projectWeight(answers);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-display text-[15px] font-extrabold">
          <Sparkles className="h-4 w-4 shrink-0 text-accent" />
          {t(locale, "co.recap_title")}
        </span>
        {/* Changing their mind should cost one tap, not a support message. */}
        <Link
          href="/start"
          className="shrink-0 text-[11px] font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          {t(locale, "co.recap_redo")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<Flame className="h-3.5 w-3.5" />}
          value={String(targets.calories)}
          label={t(locale, "co.recap_kcal")}
        />
        <Stat
          value={t(locale, DAYS_LABEL[answers.trainingDays] ?? "diet.td_3_4")}
          label={t(locale, "co.recap_days")}
        />
        <Stat
          icon={<Target className="h-3.5 w-3.5" />}
          value={`${answers.targetWeightKg} ${t(locale, "fn.unit_kg")}`}
          label={t(locale, "co.recap_target")}
        />
      </div>

      <p className="text-[12px] leading-relaxed text-muted">{t(locale, "co.recap_body")}</p>
    </section>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-bg/40 px-1 py-2.5 text-center">
      {icon && <span className="text-accent">{icon}</span>}
      <span className="font-display text-[15px] font-extrabold leading-tight">
        <bdi>{value}</bdi>
      </span>
      <span className="text-[10.5px] leading-tight text-muted">{label}</span>
    </div>
  );
}

/**
 * For the reader who arrived at the price without ever seeing a plan — a
 * direct link, a bookmark, an ad pointed at /checkout rather than /start.
 *
 * Offers the funnel instead of arguing here. Two minutes of their own numbers
 * does more than any amount of copy on this screen, and it costs them nothing
 * to find out.
 */
export function BuildPlanPrompt({ locale }: { locale: Locale }) {
  return (
    <Link
      href="/start"
      className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5 transition-colors hover:bg-white/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15">
        <Sparkles className="h-[18px] w-[18px] text-accent" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-[14.5px] font-extrabold leading-tight">
          {t(locale, "co.build_plan")}
        </span>
        <span className="text-[12.5px] leading-snug text-muted">
          {t(locale, "co.build_plan_sub")}
        </span>
      </span>
    </Link>
  );
}
