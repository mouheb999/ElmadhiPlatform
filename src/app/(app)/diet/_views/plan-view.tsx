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
export async function PlanView({ locale, userId }: { locale: Locale; userId: string }) {
  const supabase = await createClient();

  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!dietProfile) redirect("/diet/questions");

  const { data: macros } = await supabase
    .from("macro_targets")
    .select("calories, protein_g, carbs_g, fat_g")
    .eq("diet_profile_id", dietProfile.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!macros) redirect("/diet/questions");

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
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
      } | null;
    }[];
  };

  const [{ data: mealRowsRaw, error: mealRowsError }, { data: ingredientsRaw }] = await Promise.all([
    supabase
      .from("meal_plan_meals")
      .select(
        "id, meal_type, order_index, meal_plan_items(id, ingredient_id, quantity_g, nutrition_ingredients(name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url))",
      )
      .eq("meal_plan_id", plan.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("nutrition_ingredients")
      .select("id, name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url")
      .order("slot", { ascending: true }),
  ]);

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
