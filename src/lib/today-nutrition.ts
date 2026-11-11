import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { tunisDateKey } from "@/lib/dates";
import { MEAL_SLOT_ORDER } from "@/lib/meal-slots";
import type { MacroTotals } from "@/lib/algorithms/nutrition-feedback";

export type SlotTotal = { slot: string; calories: number };

export type TodayNutrition = {
  /** Null until a diet plan exists. */
  target: MacroTotals | null;
  consumed: MacroTotals;
  /** Calories logged per meal slot today, in eating order. Empty if nothing logged. */
  bySlot: SlotTotal[];
};

/**
 * Today's nutrition for one user: the plan's targets, what has been logged,
 * and how it splits across meals.
 *
 * `cache()`d per request because two sections of the Today screen read it —
 * the rings at the top (food and protein) and the food card further down —
 * and each is its own Suspense boundary so neither holds up the page. Without
 * the cache that was two copies of the same three queries on every load.
 *
 * Still two round-trips deep (the targets are keyed to the diet profile), which
 * is exactly why both callers sit behind Suspense rather than in the page body.
 */
export const getTodayNutrition = cache(async (userId: string): Promise<TodayNutrition> => {
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
      .select("calories, protein_g, carbs_g, fat_g, meal_slot")
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

  const logs = todayLogs ?? [];

  const consumed = logs.reduce<MacroTotals>(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      proteinG: acc.proteinG + log.protein_g,
      carbsG: acc.carbsG + log.carbs_g,
      fatG: acc.fatG + log.fat_g,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const perSlot = new Map<string, number>();
  for (const log of logs) {
    const slot = log.meal_slot ?? "other";
    perSlot.set(slot, (perSlot.get(slot) ?? 0) + log.calories);
  }
  const rank = (slot: string) => {
    const i = MEAL_SLOT_ORDER.indexOf(slot);
    return i === -1 ? MEAL_SLOT_ORDER.length : i;
  };
  const bySlot = [...perSlot.entries()]
    .map(([slot, calories]) => ({ slot, calories }))
    .sort((a, b) => rank(a.slot) - rank(b.slot));

  const target = macros
    ? {
        calories: macros.calories,
        proteinG: macros.protein_g,
        carbsG: macros.carbs_g,
        fatG: macros.fat_g,
      }
    : null;

  return { target, consumed, bySlot };
});
