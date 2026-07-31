import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanEditor, type EditorMeal } from "@/components/diet/plan-editor";
import { LoadFailure } from "@/components/shared/load-failure";
import type { Locale } from "@/lib/i18n";

/**
 * Plan view of the unified /diet home — the generated meal template as a
 * reference the user can adjust. Self-contained data-loading (moved from the
 * former /diet/plan page) so the shell can compose it under the tab bar.
 */
export async function PlanView({
  locale,
  userId,
  dietProfileId,
}: {
  locale: Locale;
  userId: string;
  /** Active diet profile, already resolved by the /diet shell. */
  dietProfileId: string;
}) {
  const supabase = await createClient();

  // Targets and the plan itself are independent lookups; the catalog that backs
  // the swap picker depends on neither. Asking for all three at once turns what
  // was a four-deep chain of round-trips into two.
  const [{ data: macros }, { data: plan }, { data: ingredientsRaw }] =
    await Promise.all([
      supabase
        .from("macro_targets")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("diet_profile_id", dietProfileId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nutrition_ingredients")
        .select(
          "id, name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams, breakfast_ok",
        )
        .order("slot", { ascending: true }),
    ]);
  if (!macros) redirect("/diet/questions");
  if (!plan) redirect("/diet/questions");

  type MealRow = {
    id: string;
    meal_type: string;
    meal_plan_items: {
      id: string;
      ingredient_id: string | null;
      quantity_g: number;
      nutrition_ingredients: {
        name_en: string | null;
        name_ar: string;
        slot: string;
        calories_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
        image_url: string | null;
        unit_en: string | null;
        unit_en_plural: string | null;
        unit_ar: string | null;
        unit_ar_plural: string | null;
        unit_grams: number | null;
      } | null;
    }[];
  };

  const { data: mealRowsRaw, error: mealRowsError } = await supabase
    .from("meal_plan_meals")
    .select(
      "id, meal_type, order_index, meal_plan_items(id, ingredient_id, quantity_g, nutrition_ingredients(name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams))",
    )
    .eq("meal_plan_id", plan.id)
    .order("order_index", { ascending: true });

  if (mealRowsError) {
    return <LoadFailure detail={mealRowsError.message} />;
  }

  const mealRows = (mealRowsRaw ?? []) as unknown as MealRow[];

  const meals: EditorMeal[] = mealRows.map((meal) => ({
    id: meal.id,
    mealType: meal.meal_type,
    items: (meal.meal_plan_items ?? [])
      .filter((item) => item.nutrition_ingredients)
      .map((item) => ({
        id: item.id,
        ingredientId: item.ingredient_id!,
        nameEn: item.nutrition_ingredients!.name_en,
        nameAr: item.nutrition_ingredients!.name_ar,
        slot: item.nutrition_ingredients!.slot,
        quantityG: item.quantity_g,
        caloriesPer100g: item.nutrition_ingredients!.calories_per_100g,
        proteinPer100g: item.nutrition_ingredients!.protein_per_100g,
        carbsPer100g: item.nutrition_ingredients!.carbs_per_100g,
        fatPer100g: item.nutrition_ingredients!.fat_per_100g,
        imageUrl: item.nutrition_ingredients!.image_url,
        unitEn: item.nutrition_ingredients!.unit_en,
        unitEnPlural: item.nutrition_ingredients!.unit_en_plural,
        unitAr: item.nutrition_ingredients!.unit_ar,
        unitArPlural: item.nutrition_ingredients!.unit_ar_plural,
        unitGrams: item.nutrition_ingredients!.unit_grams,
      })),
  }));

  const ingredients = (ingredientsRaw ?? []).map((i) => ({
    id: i.id,
    nameEn: i.name_en,
    nameAr: i.name_ar,
    slot: i.slot,
    caloriesPer100g: i.calories_per_100g,
    proteinPer100g: i.protein_per_100g,
    carbsPer100g: i.carbs_per_100g,
    fatPer100g: i.fat_per_100g,
    imageUrl: i.image_url,
    unitEn: i.unit_en,
    unitEnPlural: i.unit_en_plural,
    unitAr: i.unit_ar,
    unitArPlural: i.unit_ar_plural,
    unitGrams: i.unit_grams,
    breakfastOk: i.breakfast_ok ?? true,
  }));

  return (
    <PlanEditor
      locale={locale}
      planId={plan.id}
      target={{ calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }}
      initialMeals={meals}
      ingredients={ingredients}
    />
  );
}
