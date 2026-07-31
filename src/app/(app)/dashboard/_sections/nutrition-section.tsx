import { createClient } from "@/lib/supabase/server";
import { tunisDateKey } from "@/lib/dates";
import type { Locale } from "@/lib/i18n";
import { NutritionLiveTile } from "@/components/dashboard/nutrition-live-tile";

/**
 * Today's macros vs. target.
 *
 * Its own async component so it can be suspended. It owns the only chain on
 * this page that was two round-trips deep — diet_profiles, then the
 * macro_targets keyed to it — and none of the coaching content above depends
 * on the answer. Held in the page body, that chain decided when the whole
 * dashboard was allowed to paint; suspended, it decides when one tile does.
 */
export async function NutritionSection({ locale, userId }: { locale: Locale; userId: string }) {
  const supabase = await createClient();

  const [{ data: dietProfile }, { data: todayLogs }] = await Promise.all([
    supabase
      .from("diet_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("log_date", tunisDateKey()),
  ]);

  const { data: macros } = dietProfile
    ? await supabase
        .from("macro_targets")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("diet_profile_id", dietProfile.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const consumed = (todayLogs ?? []).reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      proteinG: acc.proteinG + log.protein_g,
      carbsG: acc.carbsG + log.carbs_g,
      fatG: acc.fatG + log.fat_g,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const target = macros
    ? {
        calories: macros.calories,
        proteinG: macros.protein_g,
        carbsG: macros.carbs_g,
        fatG: macros.fat_g,
      }
    : null;

  return <NutritionLiveTile locale={locale} target={target} consumed={consumed} />;
}

/** Same footprint as the tile, so nothing jumps when the real one lands. */
export function NutritionSectionSkeleton() {
  return <div className="h-32 w-full animate-pulse rounded-3xl bg-surface" aria-hidden />;
}
