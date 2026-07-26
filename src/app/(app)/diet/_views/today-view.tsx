import { createClient } from "@/lib/supabase/server";
import {
  FoodDiary,
  type DiaryEntry,
  type DiaryFood,
  type DiaryPlanMeal,
  type DiaryTargets,
} from "@/components/diet/food-diary";
import type { Locale } from "@/lib/i18n";

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Today view of the unified /diet home (V1.5): logged meals vs. targets for a
 * browsable day, with every friction-killer entry path — from the plan, search,
 * recents, favorites, quick calories, copy the last logged day. Logging is only
 * open on today; past days are read-only history. Self-contained data-loading
 * (moved from the former /diet/log page) so the shell can compose it under the
 * tab bar.
 */
export async function TodayView({
  locale,
  userId,
  dateParam,
}: {
  locale: Locale;
  userId: string;
  dateParam?: string;
}) {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  let viewDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  if (viewDate > today) viewDate = today;
  const isToday = viewDate === today;

  const dateLabel = new Date(`${viewDate}T00:00:00`).toLocaleDateString(
    locale === "tn" ? "ar-TN" : "en-GB",
    { weekday: "long", day: "numeric", month: "long" },
  );

  type LogRow = {
    id: string;
    meal_slot: string | null;
    custom_name: string | null;
    quantity_g: number | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    nutrition_ingredients: { name_en: string | null; name_ar: string | null; image_url: string | null } | null;
  };
  type FoodJoinRow = {
    ingredient_id: string;
    nutrition_ingredients: {
      id: string;
      name_en: string | null;
      name_ar: string;
      calories_per_100g: number;
      protein_per_100g: number;
      carbs_per_100g: number;
      fat_per_100g: number;
      image_url: string | null;
    } | null;
  };

  const [
    { data: dietProfile },
    { data: todayLogsRaw },
    { data: favoritesRaw },
    { data: recentsRaw },
    { data: ingredientsRaw },
    { data: previousRow },
    { data: mealPlan },
  ] = await Promise.all([
    supabase.from("diet_profiles").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    supabase
      .from("meal_logs")
      .select(
        "id, meal_slot, custom_name, quantity_g, calories, protein_g, carbs_g, fat_g, nutrition_ingredients(name_en, name_ar, image_url)",
      )
      .eq("user_id", userId)
      .eq("log_date", viewDate)
      .order("logged_at", { ascending: true }),
    supabase
      .from("food_favorites")
      .select(
        "ingredient_id, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("meal_logs")
      .select(
        "ingredient_id, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url)",
      )
      .eq("user_id", userId)
      .not("ingredient_id", "is", null)
      .order("logged_at", { ascending: false })
      .limit(40),
    supabase
      .from("nutrition_ingredients")
      .select("id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url")
      .order("slot", { ascending: true }),
    supabase
      .from("meal_logs")
      .select("id")
      .eq("user_id", userId)
      .lt("log_date", today)
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
  ]);

  // The generated plan, so the diary can log straight from it (one tap per
  // meal or per item) instead of making the user re-find the same foods.
  type PlanMealRow = {
    id: string;
    meal_type: string;
    order_index: number;
    meal_plan_items: {
      ingredient_id: string | null;
      quantity_g: number;
      nutrition_ingredients: {
        id: string;
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
  const { data: planMealsRaw } = mealPlan
    ? await supabase
        .from("meal_plan_meals")
        .select(
          "id, meal_type, order_index, meal_plan_items(ingredient_id, quantity_g, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url))",
        )
        .eq("meal_plan_id", mealPlan.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const planMeals: DiaryPlanMeal[] = ((planMealsRaw ?? []) as unknown as PlanMealRow[]).map((meal) => ({
    id: meal.id,
    mealType: meal.meal_type,
    items: (meal.meal_plan_items ?? [])
      .filter((item) => item.nutrition_ingredients)
      .map((item) => ({
        food: {
          id: item.nutrition_ingredients!.id,
          nameEn: item.nutrition_ingredients!.name_en,
          nameAr: item.nutrition_ingredients!.name_ar,
          caloriesPer100g: item.nutrition_ingredients!.calories_per_100g,
          proteinPer100g: item.nutrition_ingredients!.protein_per_100g,
          carbsPer100g: item.nutrition_ingredients!.carbs_per_100g,
          fatPer100g: item.nutrition_ingredients!.fat_per_100g,
          imageUrl: item.nutrition_ingredients!.image_url,
        },
        quantityG: item.quantity_g,
      })),
  }));

  const { data: macros } = dietProfile
    ? await supabase
        .from("macro_targets")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("diet_profile_id", dietProfile.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const targets: DiaryTargets | null = macros
    ? { calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }
    : null;

  const entries: DiaryEntry[] = ((todayLogsRaw ?? []) as unknown as LogRow[]).map((row) => ({
    id: row.id,
    slot: row.meal_slot ?? "snack",
    nameEn: row.nutrition_ingredients?.name_en ?? row.custom_name,
    nameAr: row.nutrition_ingredients?.name_ar ?? row.custom_name,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    imageUrl: row.nutrition_ingredients?.image_url ?? null,
  }));

  function toDiaryFood(row: FoodJoinRow): DiaryFood | null {
    const ing = row.nutrition_ingredients;
    if (!ing) return null;
    return {
      id: ing.id,
      nameEn: ing.name_en,
      nameAr: ing.name_ar,
      caloriesPer100g: ing.calories_per_100g,
      proteinPer100g: ing.protein_per_100g,
      carbsPer100g: ing.carbs_per_100g,
      fatPer100g: ing.fat_per_100g,
      imageUrl: ing.image_url,
    };
  }

  const ingredients: DiaryFood[] = ((ingredientsRaw ?? []) as unknown as FoodJoinRow["nutrition_ingredients"][])
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map((i) => ({
      id: i.id,
      nameEn: i.name_en,
      nameAr: i.name_ar,
      caloriesPer100g: i.calories_per_100g,
      proteinPer100g: i.protein_per_100g,
      carbsPer100g: i.carbs_per_100g,
      fatPer100g: i.fat_per_100g,
      imageUrl: i.image_url,
    }));

  const favorites = ((favoritesRaw ?? []) as unknown as FoodJoinRow[])
    .map(toDiaryFood)
    .filter((f): f is DiaryFood => f !== null);

  const seen = new Set<string>();
  const recents: DiaryFood[] = [];
  for (const row of (recentsRaw ?? []) as unknown as FoodJoinRow[]) {
    const food = toDiaryFood(row);
    if (!food || seen.has(food.id)) continue;
    seen.add(food.id);
    recents.push(food);
    if (recents.length >= 10) break;
  }

  return (
    <FoodDiary
      locale={locale}
      targets={targets}
      entries={entries}
      recents={recents}
      favorites={favorites}
      ingredients={ingredients}
      planMeals={planMeals}
      hasPreviousDay={!!previousRow}
      isToday={isToday}
      dateLabel={dateLabel}
      prevDate={shiftDate(viewDate, -1)}
      nextDate={isToday ? null : shiftDate(viewDate, 1)}
    />
  );
}
