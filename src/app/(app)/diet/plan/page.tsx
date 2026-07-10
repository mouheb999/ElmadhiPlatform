import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { PlanEditor, type EditorMeal } from "@/components/diet/plan-editor";
import { LoadFailure } from "@/components/shared/load-failure";

export const dynamic = "force-dynamic";

export default async function DietPlanPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id")
    .eq("user_id", user!.id)
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
    .eq("user_id", user!.id)
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
      food_id: string | null;
      quantity_g: number;
      foods: {
        name_en: string | null;
        name_ar: string;
        calories_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
        image_url: string | null;
      } | null;
    }[];
  };

  const { data: mealRowsRaw, error: mealRowsError } = await supabase
    .from("meal_plan_meals")
    .select(
      "id, meal_type, order_index, meal_plan_items(id, food_id, quantity_g, foods(name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url))",
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
      .filter((item) => item.foods)
      .map((item) => ({
        id: item.id,
        foodId: item.food_id!,
        nameEn: item.foods!.name_en,
        nameAr: item.foods!.name_ar,
        quantityG: item.quantity_g,
        caloriesPer100g: item.foods!.calories_per_100g,
        proteinPer100g: item.foods!.protein_per_100g,
        carbsPer100g: item.foods!.carbs_per_100g,
        fatPer100g: item.foods!.fat_per_100g,
        imageUrl: item.foods!.image_url,
      })),
  }));

  return (
    <PlanEditor
      locale={locale}
      planId={plan.id}
      target={{ calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }}
      initialMeals={meals}
    />
  );
}
