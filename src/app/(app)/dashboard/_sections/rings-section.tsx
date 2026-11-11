import type { Locale } from "@/lib/i18n";
import { getTodayNutrition } from "@/lib/today-nutrition";
import { TodayRings } from "@/components/dashboard/today-rings";

/**
 * The rings at the top of Today.
 *
 * Training arrives as props — the page already computed the week — but food
 * and protein need today's nutrition, which is two round-trips deep. So this
 * is its own Suspense boundary, like the food card below it, and both read the
 * same request-cached fetch (`getTodayNutrition`): one set of queries, two
 * places on screen, and neither holds up the rest of the page.
 */
export async function RingsSection({
  locale,
  userId,
  training,
}: {
  locale: Locale;
  userId: string;
  training: { value: number; target: number };
}) {
  const { target, consumed } = await getTodayNutrition(userId);
  return (
    <TodayRings
      locale={locale}
      href="/review"
      training={training}
      food={{ value: consumed.calories, target: target?.calories ?? 0 }}
      protein={{ value: consumed.proteinG, target: target?.proteinG ?? 0 }}
    />
  );
}

/** The rings card's footprint, so nothing moves when it lands. */
export function RingsSectionSkeleton() {
  return <div className="h-40 w-full animate-pulse rounded-card bg-surface" aria-hidden />;
}
