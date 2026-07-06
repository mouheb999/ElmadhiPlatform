import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { t, pick, type Locale } from "@/lib/i18n";

export type MealsTileMeal = {
  id: string;
  mealType: string;
  kcal: number;
};

const MEAL_LABELS: Record<string, { en: string; ar: string }> = {
  breakfast: { en: "Breakfast", ar: "الفطور" },
  lunch: { en: "Lunch", ar: "الغدا" },
  dinner: { en: "Dinner", ar: "العشا" },
  snack_1: { en: "Snack", ar: "وجبة خفيفة" },
  snack_2: { en: "Snack 2", ar: "وجبة خفيفة ٢" },
};

/** Today's meals from the active plan, one glance, one tap to the full plan. */
export function MealsTile({ locale, meals }: { locale: Locale; meals: MealsTileMeal[] }) {
  if (meals.length === 0) {
    return (
      <div className="flex h-full flex-col justify-between rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted">{t(locale, "today.meals_title")}</span>
          <UtensilsCrossed className="h-4 w-4 text-muted" />
        </div>
        <Link href="/diet" className="mt-2 inline-block text-sm font-bold text-accent">
          {t(locale, "dashboard.cta_start")} →
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/diet/plan"
      className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted">{t(locale, "today.meals_title")}</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/15">
          <UtensilsCrossed className="h-3.5 w-3.5 text-accent" />
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {meals.map((meal) => {
          const label = MEAL_LABELS[meal.mealType] ?? { en: meal.mealType, ar: meal.mealType };
          return (
            <li key={meal.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold">{pick(locale, label.en, label.ar)}</span>
              <span className="text-xs tabular-nums text-muted">{Math.round(meal.kcal)} kcal</span>
            </li>
          );
        })}
      </ul>
      <span className="mt-auto pt-2 text-xs font-bold text-accent">{t(locale, "today.open_plan")} →</span>
    </Link>
  );
}
