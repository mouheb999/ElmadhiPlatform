"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, Plus, Utensils } from "lucide-react";
import { CardTitleRow } from "@/components/shared/card-title-row";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { mealSlotLabel } from "@/lib/meal-slots";
import { nutritionFeedback, type MacroTotals } from "@/lib/algorithms/nutrition-feedback";
import type { SlotTotal } from "@/lib/today-nutrition";

const fmt = new Intl.NumberFormat("en-US");

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Today's food: what's left, how it splits, and what has been logged.
 *
 * Drawn like a native grouped list — the headline number and macro bar on
 * top, then one row per meal already logged with a separator inset from the
 * leading edge, then a row to log the next one.
 *
 * The macros carry the same colours the rings use: protein in cyan, carbs in
 * the food orange, fat in violet. The bar is stacked against the day's
 * calorie target, so the empty remainder is literally the "left" in the
 * headline.
 *
 * `bySlot` is optional because the checkout preview renders this component
 * with sample totals and no per-meal breakdown; it then shows the header, the
 * bar and the log row.
 */
export function NutritionLiveTile({
  locale,
  target,
  consumed,
  bySlot = [],
}: {
  locale: Locale;
  target: MacroTotals | null;
  consumed: MacroTotals;
  bySlot?: SlotTotal[];
}) {
  const mounted = useMounted();

  const header = (
    <CardTitleRow title={t(locale, "home.food")} href="/diet?view=today" linkLabel={t(locale, "home.diary")} />
  );

  if (!target) {
    return (
      <section aria-label={t(locale, "home.food")} className="card-surface flex flex-col gap-4 p-5">
        {header}
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fuel/15 text-fuel">
            <Utensils className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(locale, "dashboard.not_setup")}</p>
            <Link href="/diet" transitionTypes={["tab"]} className="press mt-0.5 inline-block text-[15px] text-fuel">
              {t(locale, "dashboard.cta_start")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const left = target.calories - consumed.calories;
  const over = left < 0;
  const share = (kcal: number) => (target.calories > 0 ? Math.max(0, (kcal / target.calories) * 100) : 0);
  // Energy per macro, as a share of the day's calorie target.
  const segments = [
    { key: "home.protein" as const, pct: share(consumed.proteinG * 4), bar: "bg-protein", grams: consumed.proteinG },
    { key: "home.carbs" as const, pct: share(consumed.carbsG * 4), bar: "bg-fuel", grams: consumed.carbsG },
    { key: "home.fat" as const, pct: share(consumed.fatG * 9), bar: "bg-sleep", grams: consumed.fatG },
  ];
  // Only read the clock after hydration: the server's hour is not the user's.
  const coachKey = mounted ? nutritionFeedback(consumed, target, new Date().getHours(), 1)[0] : undefined;

  return (
    <section aria-label={t(locale, "home.food")}>
      <div className="card-surface overflow-hidden">
        <div className="px-5 pb-4 pt-5">
          {header}
          {/* The figure and its unit share the food orange (pink once over
              target), the way native summaries colour the number itself. */}
          <div className={cn("mt-3 flex items-baseline gap-1.5", over ? "text-danger" : "text-fuel")}>
            <span className="font-num text-[40px] font-bold leading-none tracking-[-0.02em]">
              {fmt.format(Math.round(Math.abs(left)))}
            </span>
            <span className="text-[15px] font-bold uppercase">
              {t(locale, over ? "home.kcal_over" : "home.kcal_left")}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {t(locale, "home.of_target").replace("{n}", fmt.format(Math.round(target.calories)))} {t(locale, "home.kcal")}
          </p>

          <div className="mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface2" aria-hidden>
            {segments.map((s) => (
              <span key={s.key} className={s.bar} style={{ width: `${Math.min(s.pct, 100)}%` }} />
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {segments.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", s.bar)} />
                {t(locale, s.key)} {Math.round(s.grams)} {t(locale, "home.g")}
              </span>
            ))}
          </div>

          {coachKey && (
            <p className="mt-3 text-[13px] font-medium leading-snug text-[#D4D4D8]">{t(locale, coachKey as StringKey)}</p>
          )}
        </div>

        <ul>
          {bySlot.map((row) => (
            <li key={row.slot} className="flex h-[58px] items-center gap-3.5 ps-5">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-surface2 text-[#D4D4D8]">
                <Utensils className="h-[18px] w-[18px]" />
              </span>
              <div className="flex h-full flex-1 items-center justify-between border-t-[0.5px] border-white/[0.09] pe-5">
                <div>
                  <p className="text-base">{mealSlotLabel(locale, row.slot)}</p>
                  <p className="text-[13px] text-subtle">
                    {fmt.format(Math.round(row.calories))} {t(locale, "home.kcal")}
                  </p>
                </div>
                <Check className="h-5 w-5 text-subtle" strokeWidth={2.4} aria-hidden />
              </div>
            </li>
          ))}
          <li>
            <Link href="/diet?view=today" transitionTypes={["tab"]} className="press flex h-[58px] items-center gap-3.5 ps-5">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-fuel/15 text-fuel">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </span>
              <span className="flex h-full flex-1 items-center border-t-[0.5px] border-white/[0.09] pe-5 font-semibold text-fuel">
                {t(locale, "tile.log_food")}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
