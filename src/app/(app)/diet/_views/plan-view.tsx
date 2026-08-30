import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanEditor, type EditorMeal } from "@/components/diet/plan-editor";
import { LoadFailure } from "@/components/shared/load-failure";
import { encodeFoodRef } from "@/lib/food-ref";
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
  const [
    { data: macros },
    { data: plan },
    { data: ingredientsRaw },
    { data: userFoodsRaw, error: userFoodsError },
  ] = await Promise.all([
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
        // Retired foods (migration 049: parsley, semolina) stay in the table so
        // the plans and logs that point at them still resolve, but they are
        // never offered again.
        .eq("in_catalog", true)
        .order("slot", { ascending: true }),
      // The user's own foods sit in the same picker as the catalog, so the swap
      // and add lists offer everything they can actually eat rather than
      // everything we happen to have curated.
      supabase
        .from("user_foods")
        .select(
          "id, name, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams",
        )
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
    ]);
  if (!macros) redirect("/diet/questions");
  if (!plan) redirect("/diet/questions");

  /** The columns a plan row needs, whichever table the food came from. */
  type FoodSource = {
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
  };
  type MealRow = {
    id: string;
    meal_type: string;
    meal_plan_items: {
      id: string;
      ingredient_id: string | null;
      user_food_id: string | null;
      quantity_g: number;
      nutrition_ingredients: FoodSource | null;
      // A user food has no image and its Arabic name is optional, so it is
      // reshaped below rather than selected into the same alias.
      user_foods: (Omit<FoodSource, "name_ar" | "image_url"> & { name: string; name_ar: string | null }) | null;
    }[];
  };

  const { data: mealRowsRaw, error: mealRowsError } = await supabase
    .from("meal_plan_meals")
    .select(
      "id, meal_type, order_index, meal_plan_items(id, ingredient_id, user_food_id, quantity_g, nutrition_ingredients(name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams), user_foods(name, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams))",
    )
    .eq("meal_plan_id", plan.id)
    .order("order_index", { ascending: true });

  // `user_foods` arrives with migration 043, and the meals query joins it. On a
  // database that hasn't applied it, Postgrest rejects both outright — surface
  // that instead of rendering a plan with no food in it, which is what an
  // ignored error here would look like.
  if (mealRowsError || userFoodsError) {
    return <LoadFailure detail={(mealRowsError ?? userFoodsError)?.message} />;
  }

  const mealRows = (mealRowsRaw ?? []) as unknown as MealRow[];

  const meals: EditorMeal[] = mealRows.map((meal) => ({
    id: meal.id,
    mealType: meal.meal_type,
    items: (meal.meal_plan_items ?? [])
      .map((item) => {
        // Exactly one of the two is set (migration 043's CHECK), so this picks
        // the row's food without needing to know which kind it is.
        const catalog = item.nutrition_ingredients;
        const own = item.user_foods;
        const source: FoodSource | null = catalog
          ? catalog
          : own
            ? { ...own, name_en: own.name, name_ar: own.name_ar ?? own.name, image_url: null }
            : null;
        if (!source) return null;

        return {
          id: item.id,
          foodRef: encodeFoodRef(
            catalog
              ? { kind: "catalog", id: item.ingredient_id! }
              : { kind: "user", id: item.user_food_id! },
          ),
          nameEn: source.name_en,
          nameAr: source.name_ar,
          slot: source.slot,
          quantityG: item.quantity_g,
          caloriesPer100g: source.calories_per_100g,
          proteinPer100g: source.protein_per_100g,
          carbsPer100g: source.carbs_per_100g,
          fatPer100g: source.fat_per_100g,
          imageUrl: source.image_url,
          unitEn: source.unit_en,
          unitEnPlural: source.unit_en_plural,
          unitAr: source.unit_ar,
          unitArPlural: source.unit_ar_plural,
          unitGrams: source.unit_grams,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  }));

  const ingredients = [
    ...(ingredientsRaw ?? []).map((i) => ({
      id: encodeFoodRef({ kind: "catalog", id: i.id }),
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
      isOwn: false,
    })),
    ...(userFoodsRaw ?? []).map((f) => ({
      id: encodeFoodRef({ kind: "user", id: f.id }),
      nameEn: f.name,
      nameAr: f.name_ar ?? f.name,
      slot: f.slot,
      caloriesPer100g: f.calories_per_100g,
      proteinPer100g: f.protein_per_100g,
      carbsPer100g: f.carbs_per_100g,
      fatPer100g: f.fat_per_100g,
      imageUrl: null,
      unitEn: f.unit_en,
      unitEnPlural: f.unit_en_plural,
      unitAr: f.unit_ar,
      unitArPlural: f.unit_ar_plural,
      unitGrams: f.unit_grams,
      // Nothing about a user's own food says it is wrong at breakfast — the
      // flag exists to keep the *generator* from putting tuna in Meal 1, and
      // nothing generates these.
      breakfastOk: true,
      isOwn: true,
    })),
  ];

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
