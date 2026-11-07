import type { Locale } from "@/lib/i18n";
import { getTodayNutrition } from "@/lib/today-nutrition";
import { NutritionLiveTile } from "@/components/dashboard/nutrition-live-tile";

/**
 * Today's food card.
 *
 * Its own async component so it can be suspended: today's targets are two
 * round-trips deep (diet profile, then the macro targets keyed to it) and none
 * of the coaching content above depends on the answer. It shares that fetch
 * with the rings at the top of the page through `getTodayNutrition`, which is
 * cached per request — two sections, one set of queries.
 */
export async function NutritionSection({ locale, userId }: { locale: Locale; userId: string }) {
  const { target, consumed, bySlot } = await getTodayNutrition(userId);
  return <NutritionLiveTile locale={locale} target={target} consumed={consumed} bySlot={bySlot} />;
}

/** Same footprint as the card, so nothing jumps when the real one lands. */
export function NutritionSectionSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-3 h-7 w-24 animate-pulse rounded-lg bg-surface" />
      <div className="h-52 w-full animate-pulse rounded-card bg-surface" />
    </div>
  );
}
