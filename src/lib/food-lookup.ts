import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { parseFoodRef, type FoodRef } from "@/lib/food-ref";

/**
 * Server-side resolution of a food reference to the numbers we will store.
 *
 * The rule this exists to keep unbroken: macros are never taken from the
 * client. `logFood` has always looked its food up in the catalog and computed
 * kcal/protein/carbs/fat from the stored per-100g values, so an entry survives
 * later edits to the food and a caller cannot post 3000 kcal of chicken as 0.
 * Adding a second food table would have meant either duplicating that lookup or
 * relaxing it; this keeps one lookup with one branch inside it.
 *
 * A user food is read scoped to `userId`. That is the check — RLS enforces the
 * same thing, but this is the layer that turns "somebody else's food id" into a
 * null rather than into a row.
 */

export type ResolvedFood = {
  /** Exactly one of these is set — the shape both meal_logs and
   *  meal_plan_items store, and what their CHECK constraints require. */
  ingredientId: string | null;
  userFoodId: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export async function resolveFood(
  supabase: SupabaseClient<Database>,
  userId: string,
  ref: string | FoodRef,
): Promise<ResolvedFood | null> {
  const parsed = typeof ref === "string" ? parseFoodRef(ref) : ref;

  if (parsed.kind === "user") {
    const { data } = await supabase
      .from("user_foods")
      .select("id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .eq("is_archived", false)
      .maybeSingle();
    if (!data) return null;
    return {
      ingredientId: null,
      userFoodId: data.id,
      caloriesPer100g: data.calories_per_100g,
      proteinPer100g: data.protein_per_100g,
      carbsPer100g: data.carbs_per_100g,
      fatPer100g: data.fat_per_100g,
    };
  }

  const { data } = await supabase
    .from("nutrition_ingredients")
    .select("id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .eq("id", parsed.id)
    .maybeSingle();
  if (!data) return null;
  return {
    ingredientId: data.id,
    userFoodId: null,
    caloriesPer100g: data.calories_per_100g,
    proteinPer100g: data.protein_per_100g,
    carbsPer100g: data.carbs_per_100g,
    fatPer100g: data.fat_per_100g,
  };
}

/** Macros for a portion, rounded the way every log row already stores them. */
export function macrosForPortion(food: ResolvedFood, quantityG: number) {
  const factor = quantityG / 100;
  const round = (value: number) => Math.round(value * factor * 10) / 10;
  return {
    calories: round(food.caloriesPer100g),
    protein_g: round(food.proteinPer100g),
    carbs_g: round(food.carbsPer100g),
    fat_g: round(food.fatPer100g),
  };
}
