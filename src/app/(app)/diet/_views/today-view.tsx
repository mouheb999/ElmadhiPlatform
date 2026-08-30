import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/subscription-server";
import {
  FoodDiary,
  type DiaryEntry,
  type DiaryFood,
  type DiaryPlanMeal,
  type DiaryTargets,
} from "@/components/diet/food-diary";
import { LoadFailure } from "@/components/shared/load-failure";
import type { Locale } from "@/lib/i18n";
import { tunisDateKey } from "@/lib/dates";
import { encodeFoodRef } from "@/lib/food-ref";

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
  dietProfileId,
  dateParam,
}: {
  locale: Locale;
  userId: string;
  /** Active diet profile, already resolved by the /diet shell. */
  dietProfileId: string;
  dateParam?: string;
}) {
  const supabase = await createClient();

  // Africa/Tunis, matching what the log actions stamp rows with — in UTC this
  // view spent the first hour of every Tunis day showing "yesterday" as today.
  const today = tunisDateKey();
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
    /** Set instead when the entry was one of the user's own foods. */
    user_foods: { name: string; name_ar: string | null } | null;
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
      unit_en: string | null;
      unit_en_plural: string | null;
      unit_ar: string | null;
      unit_ar_plural: string | null;
      unit_grams: number | null;
    } | null;
  };

  const [
    { data: macros },
    { data: todayLogsRaw, error: todayLogsError },
    { data: favoritesRaw },
    { data: recentsRaw },
    { data: ingredientsRaw },
    { data: previousRow },
    { data: mealPlan },
    { data: userFoodsRaw },
  ] = await Promise.all([
    supabase
      .from("macro_targets")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("diet_profile_id", dietProfileId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select(
        "id, meal_slot, custom_name, quantity_g, calories, protein_g, carbs_g, fat_g, nutrition_ingredients(name_en, name_ar, image_url), user_foods(name, name_ar)",
      )
      .eq("user_id", userId)
      .eq("log_date", viewDate)
      .order("logged_at", { ascending: true }),
    supabase
      .from("food_favorites")
      .select(
        "ingredient_id, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("meal_logs")
      .select(
        "ingredient_id, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams)",
      )
      .eq("user_id", userId)
      .not("ingredient_id", "is", null)
      .order("logged_at", { ascending: false })
      .limit(40),
    supabase
      .from("nutrition_ingredients")
      .select(
        "id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams",
      )
      // Search offers the live catalog only. A retired food already in this
      // user's history still reaches them through recents and favourites.
      .eq("in_catalog", true)
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
    // Listed in the same search box as the catalog, so "add my own food" is
    // useful the moment after it is used rather than only inside the plan.
    supabase
      .from("user_foods")
      .select(
        "id, name, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams",
      )
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
  ]);

  // The generated plan, so the diary can log straight from it (one tap per
  // meal or per item) instead of making the user re-find the same foods.
  type PlanMealRow = {
    id: string;
    meal_type: string;
    order_index: number;
    meal_plan_items: {
      ingredient_id: string | null;
      user_food_id: string | null;
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
        unit_en: string | null;
        unit_en_plural: string | null;
        unit_ar: string | null;
        unit_ar_plural: string | null;
        unit_grams: number | null;
      } | null;
      user_foods: {
        id: string;
        name: string;
        name_ar: string | null;
        calories_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
        unit_en: string | null;
        unit_en_plural: string | null;
        unit_ar: string | null;
        unit_ar_plural: string | null;
        unit_grams: number | null;
      } | null;
    }[];
  };
  const { data: planMealsRaw } = mealPlan
    ? await supabase
        .from("meal_plan_meals")
        .select(
          "id, meal_type, order_index, meal_plan_items(ingredient_id, user_food_id, quantity_g, nutrition_ingredients(id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams), user_foods(id, name, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams))",
        )
        .eq("meal_plan_id", mealPlan.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const planMeals: DiaryPlanMeal[] = ((planMealsRaw ?? []) as unknown as PlanMealRow[]).map((meal) => ({
    id: meal.id,
    mealType: meal.meal_type,
    items: (meal.meal_plan_items ?? [])
      .map((item) => {
        // Exactly one side is populated (migration 043's CHECK). A hand-built
        // plan can name the user's own foods; a generated one never does.
        const catalog = item.nutrition_ingredients;
        const own = item.user_foods;
        const food: DiaryFood | null = catalog
          ? {
              id: encodeFoodRef({ kind: "catalog", id: catalog.id }),
              nameEn: catalog.name_en,
              nameAr: catalog.name_ar,
              caloriesPer100g: catalog.calories_per_100g,
              proteinPer100g: catalog.protein_per_100g,
              carbsPer100g: catalog.carbs_per_100g,
              fatPer100g: catalog.fat_per_100g,
              imageUrl: catalog.image_url,
              unitEn: catalog.unit_en,
              unitEnPlural: catalog.unit_en_plural,
              unitAr: catalog.unit_ar,
              unitArPlural: catalog.unit_ar_plural,
              unitGrams: catalog.unit_grams,
            }
          : own
            ? {
                id: encodeFoodRef({ kind: "user", id: own.id }),
                nameEn: own.name,
                nameAr: own.name_ar ?? own.name,
                caloriesPer100g: own.calories_per_100g,
                proteinPer100g: own.protein_per_100g,
                carbsPer100g: own.carbs_per_100g,
                fatPer100g: own.fat_per_100g,
                imageUrl: null,
                unitEn: own.unit_en,
                unitEnPlural: own.unit_en_plural,
                unitAr: own.unit_ar,
                unitArPlural: own.unit_ar_plural,
                unitGrams: own.unit_grams,
                isOwn: true,
              }
            : null;
        return food ? { food, quantityG: item.quantity_g } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  }));

  // The diary query joins `user_foods` (migration 043). Without that table
  // Postgrest rejects the whole select, and the silent result would be an empty
  // day on the one screen the coaching loop is built around — a user would read
  // that as "my logs are gone", not as a pending migration.
  if (todayLogsError) return <LoadFailure detail={todayLogsError.message} />;

  const targets: DiaryTargets | null = macros
    ? { calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }
    : null;

  const entries: DiaryEntry[] = ((todayLogsRaw ?? []) as unknown as LogRow[]).map((row) => ({
    id: row.id,
    slot: row.meal_slot ?? "snack",
    // Catalog name, then the user's own food, then whatever they typed as a
    // quick entry. A user food deleted since (SET NULL, migration 043) falls
    // through to custom_name or, failing that, to nothing — the macros on the
    // row are the record, and they are untouched.
    nameEn: row.nutrition_ingredients?.name_en ?? row.user_foods?.name ?? row.custom_name,
    nameAr:
      row.nutrition_ingredients?.name_ar ??
      row.user_foods?.name_ar ??
      row.user_foods?.name ??
      row.custom_name,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    imageUrl: row.nutrition_ingredients?.image_url ?? null,
  }));

  // Favourites and recents are keyed on nutrition_ingredients only —
  // food_favorites has a NOT NULL FK to it, and the recents query filters on
  // ingredient_id. A user food reaches the diary through the search list and
  // the plan instead, which is why neither of those lists needs a user branch.
  function toDiaryFood(row: FoodJoinRow): DiaryFood | null {
    const ing = row.nutrition_ingredients;
    if (!ing) return null;
    return {
      id: encodeFoodRef({ kind: "catalog", id: ing.id }),
      nameEn: ing.name_en,
      nameAr: ing.name_ar,
      caloriesPer100g: ing.calories_per_100g,
      proteinPer100g: ing.protein_per_100g,
      carbsPer100g: ing.carbs_per_100g,
      fatPer100g: ing.fat_per_100g,
      imageUrl: ing.image_url,
      unitEn: ing.unit_en,
      unitEnPlural: ing.unit_en_plural,
      unitAr: ing.unit_ar,
      unitArPlural: ing.unit_ar_plural,
      unitGrams: ing.unit_grams,
    };
  }

  const ingredients: DiaryFood[] = [
    ...((ingredientsRaw ?? []) as unknown as FoodJoinRow["nutrition_ingredients"][])
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map((i) => ({
        id: encodeFoodRef({ kind: "catalog", id: i.id }),
        nameEn: i.name_en,
        nameAr: i.name_ar,
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
      })),
    ...(userFoodsRaw ?? []).map((f) => ({
      id: encodeFoodRef({ kind: "user", id: f.id }),
      nameEn: f.name,
      nameAr: f.name_ar ?? f.name,
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
      isOwn: true,
    })),
  ];

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
      locked={!(await hasPaidAccess())}
    />
  );
}
