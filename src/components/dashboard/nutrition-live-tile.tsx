"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Utensils } from "lucide-react";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { nutritionFeedback, type MacroTotals } from "@/lib/algorithms/nutrition-feedback";

/** Monochrome fills — the tile reads as pure progress, matching the diary. */
const NEUTRAL_FILL = "rgba(255,255,255,0.85)";

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Live nutrition on the Today screen: consumed vs. target from today's
 * meal_logs, plus the top rule-based coach message. Links into the diary.
 */
export function NutritionLiveTile({
  locale,
  target,
  consumed,
}: {
  locale: Locale;
  target: MacroTotals | null;
  consumed: MacroTotals;
}) {
  const mounted = useMounted();

  if (!target) {
    return (
      <div className="flex h-full flex-col justify-between rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted">{t(locale, "dashboard.nutrition_label")}</span>
          <Utensils className="h-4 w-4 text-muted" />
        </div>
        <div>
          <p className="text-sm text-muted">{t(locale, "dashboard.not_setup")}</p>
          <Link href="/diet" className="mt-2 inline-block text-sm font-bold text-accent">
            {t(locale, "dashboard.cta_start")} →
          </Link>
        </div>
      </div>
    );
  }

  const kcalLeft = Math.max(0, Math.round(target.calories - consumed.calories));
  const coachKey = mounted ? nutritionFeedback(consumed, target, new Date().getHours(), 1)[0] : undefined;

  const bars = [
    { label: "P", value: consumed.proteinG, max: target.proteinG, color: NEUTRAL_FILL },
    { label: "C", value: consumed.carbsG, max: target.carbsG, color: NEUTRAL_FILL },
    { label: "F", value: consumed.fatG, max: target.fatG, color: NEUTRAL_FILL },
  ];

  return (
    <Link
      href="/diet/log"
      className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted">{t(locale, "dashboard.nutrition_label")}</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/15">
          <Utensils className="h-3.5 w-3.5 text-accent" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tabular-nums">{kcalLeft}</span>
        <span className="text-xs text-muted">kcal {t(locale, "tile.left")}</span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="w-3 text-[11px] font-bold text-muted">{bar.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${bar.max > 0 ? Math.min((bar.value / bar.max) * 100, 100) : 0}%`,
                  backgroundColor: bar.color,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-end text-[11px] tabular-nums text-muted">
              {Math.round(bar.value)}/{Math.round(bar.max)}g
            </span>
          </div>
        ))}
      </div>

      {coachKey ? (
        <p className="mt-3 text-xs font-semibold text-accent">{t(locale, coachKey as StringKey)}</p>
      ) : (
        <span className="mt-3 text-xs font-bold text-accent">{t(locale, "tile.log_food")} →</span>
      )}
    </Link>
  );
}
