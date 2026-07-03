import Link from "next/link";
import { Utensils } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export type NutritionTileTarget = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const MACRO_COLORS = { protein: "#5DD62C", carbs: "#F5A623", fat: "#B76CFF" } as const;

/** Shows the day's macro *target* breakdown — not a consumed/logged progress
 * claim, since there's no food logging yet. Bars are proportional to each
 * other so the shape of the target is still readable at a glance. */
export function NutritionTile({ locale, target }: { locale: Locale; target: NutritionTileTarget | null }) {
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

  const macros = [
    { label: "Protein", g: target.proteinG, color: MACRO_COLORS.protein },
    { label: "Carbs", g: target.carbsG, color: MACRO_COLORS.carbs },
    { label: "Fat", g: target.fatG, color: MACRO_COLORS.fat },
  ];
  const max = Math.max(...macros.map((m) => m.g), 1);

  return (
    <Link
      href="/diet/plan"
      className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted">{t(locale, "dashboard.nutrition_label")}</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/15">
          <Utensils className="h-3.5 w-3.5 text-accent" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tabular-nums">{target.calories}</span>
        <span className="text-xs text-muted">kcal / day</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {macros.map((m) => (
          <div key={m.label} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{ width: `${(m.g / max) * 100}%`, backgroundColor: m.color }}
              />
            </div>
            <span className="w-12 shrink-0 text-end text-[11px] tabular-nums text-muted">{m.g}g</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
