"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePaidUser } from "@/lib/subscription-server";
import { tunisDateKey } from "@/lib/dates";
import { resolveFood, macrosForPortion } from "@/lib/food-lookup";
import { isUserFoodRef } from "@/lib/food-ref";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * An eating occasion. Normally a template meal_key so the diary lines up 1:1
 * with the meal plan; "other" catches off-plan food. The breakfast/lunch/dinner
 * values are legacy (pre-migration 029) and stay accepted so historical rows and
 * any plan still using them keep working.
 */
export type MealSlot =
  | "meal_1"
  | "snack"
  | "meal_2"
  | "meal_3"
  | "pre_workout"
  | "post_workout"
  | "last_meal"
  | "other"
  | "breakfast"
  | "lunch"
  | "dinner";

const MEAL_SLOTS: MealSlot[] = [
  "meal_1",
  "snack",
  "meal_2",
  "meal_3",
  "pre_workout",
  "post_workout",
  "last_meal",
  "other",
  "breakfast",
  "lunch",
  "dinner",
];

/** Entry paths a user can trigger today (barcode/voice/camera are V3).
 *  "plan" = a single item taken from the generated meal plan; it's stored as
 *  the DB's 'template' method since the plan is the user's meal template. */
const MANUAL_ENTRY_METHODS = ["search", "recent", "favorite", "plan"] as const;
type ManualEntryMethod = (typeof MANUAL_ENTRY_METHODS)[number];

/**
 * "Today" for a log row, in Africa/Tunis.
 *
 * This used to be `new Date().toISOString().slice(0, 10)` — UTC. Every screen
 * that reads these rows back asks for `tunisDateKey()`, so between 00:00 and
 * 01:00 Tunis a logged meal was stamped with yesterday and vanished from the
 * diary and the dashboard totals. A midnight snack is not an edge case here.
 */
function serverToday(): string {
  return tunisDateKey();
}

/**
 * Log a food from the catalog or from the user's own list.
 *
 * Unchanged in every way that matters: macros are computed server-side from the
 * stored per-100g values (never trusted from the client) and denormalized onto
 * the log row, so the entry survives later edits to the food. The only new
 * thing is which table the lookup reads — see `resolveFood`, which scopes a
 * user food to its owner.
 */
export async function logFood(input: {
  slot: MealSlot;
  /** Catalog slug, or `uf:<uuid>` for one of the user's own foods. */
  foodRef: string;
  quantityG: number;
  entryMethod: ManualEntryMethod;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (!MEAL_SLOTS.includes(input.slot)) return fail("Unknown meal slot.");
  if (!MANUAL_ENTRY_METHODS.includes(input.entryMethod)) return fail("Unknown entry method.");
  const quantity = Number(input.quantityG);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
    return fail("Quantity looks off — please double-check.");
  }

  const food = await resolveFood(supabase, user.id, input.foodRef);
  if (!food) return fail("Food not found.");

  const { error } = await supabase.from("meal_logs").insert({
    user_id: user.id,
    log_date: serverToday(),
    meal_slot: input.slot,
    ingredient_id: food.ingredientId,
    user_food_id: food.userFoodId,
    quantity_g: quantity,
    ...macrosForPortion(food, quantity),
    entry_method: input.entryMethod === "plan" ? "template" : input.entryMethod,
  });
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot: input.slot, entry_method: input.entryMethod },
  });

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/**
 * Log an entire meal from the generated plan in one tap. Items and macros
 * are read from the user's own plan server-side; nothing is trusted from
 * the client but the meal id.
 */
export async function logPlanMeal(
  mealId: string,
): Promise<ActionResult<{ logged: number }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  type Macros = {
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
  };
  type PlanMealRow = {
    id: string;
    meal_type: string;
    meal_plans: { user_id: string } | null;
    meal_plan_items: {
      ingredient_id: string | null;
      user_food_id: string | null;
      quantity_g: number;
      nutrition_ingredients: Macros | null;
      // A hand-built plan can name the user's own foods. RLS (migration 043)
      // already guarantees a plan can only ever reference its owner's, so the
      // join needs no extra scoping here.
      user_foods: Macros | null;
    }[];
  };

  const { data: mealRaw } = await supabase
    .from("meal_plan_meals")
    .select(
      "id, meal_type, meal_plans!inner(user_id), meal_plan_items(ingredient_id, user_food_id, quantity_g, nutrition_ingredients(calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g), user_foods(calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g))",
    )
    .eq("id", mealId)
    .eq("meal_plans.user_id", user.id)
    .maybeSingle();
  if (!mealRaw) return fail("Meal not found.");

  const meal = mealRaw as unknown as PlanMealRow;
  const items = (meal.meal_plan_items ?? []).filter(
    (i) => i.nutrition_ingredients ?? i.user_foods,
  );
  if (items.length === 0) return fail("This meal has no foods yet.");

  // Log against the plan's own occasion, so the diary entry sits under the
  // very meal the plan told the user to eat.
  const slot = (MEAL_SLOTS as string[]).includes(meal.meal_type)
    ? (meal.meal_type as MealSlot)
    : "other";
  const today = serverToday();

  const { error } = await supabase.from("meal_logs").insert(
    items.map((item) => {
      const source = (item.nutrition_ingredients ?? item.user_foods)!;
      const macros = macrosForPortion(
        {
          ingredientId: item.ingredient_id,
          userFoodId: item.user_food_id,
          caloriesPer100g: source.calories_per_100g,
          proteinPer100g: source.protein_per_100g,
          carbsPer100g: source.carbs_per_100g,
          fatPer100g: source.fat_per_100g,
        },
        item.quantity_g ?? 0,
      );
      return {
        user_id: user.id,
        log_date: today,
        meal_slot: slot,
        ingredient_id: item.ingredient_id,
        user_food_id: item.user_food_id,
        quantity_g: item.quantity_g,
        ...macros,
        entry_method: "template",
      };
    }),
  );
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot, entry_method: "template", count: items.length },
  });

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok({ logged: items.length });
}

/** Quick calories: a free-text entry with user-supplied macros. */
export async function logQuick(input: {
  slot: MealSlot;
  name: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (!MEAL_SLOTS.includes(input.slot)) return fail("Unknown meal slot.");
  const calories = Number(input.calories);
  if (!Number.isFinite(calories) || calories <= 0 || calories > 10000) {
    return fail("Calories look off — please double-check.");
  }

  // The one entry path where the macros come from the client rather than from a
  // food we looked up, so they need their own ceiling. Unbounded, they overflow
  // NUMERIC(6,1) — and short of that they poison the weekly review and every
  // adaptation that reads a protein average.
  const macro = (value: number | null): number | null => {
    if (value === null) return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
    return Math.round(n * 10) / 10;
  };
  const proteinG = macro(input.proteinG);
  const carbsG = macro(input.carbsG);
  const fatG = macro(input.fatG);
  if (proteinG === null || carbsG === null || fatG === null) {
    return fail("Those macros look off — please double-check.");
  }

  const { error } = await supabase.from("meal_logs").insert({
    user_id: user.id,
    log_date: serverToday(),
    meal_slot: input.slot,
    // Free text the user typed; bounded so a pasted document can't become a
    // diary row every screen then has to render.
    custom_name: input.name.trim().slice(0, 120) || null,
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    entry_method: "quick",
  });
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot: input.slot, entry_method: "quick" },
  });

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/** Copy every entry from the most recent logged day (usually yesterday). */
export async function copyPreviousDay(): Promise<ActionResult<{ copied: number }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const today = serverToday();
  const { data: lastDayRow } = await supabase
    .from("meal_logs")
    .select("log_date")
    .eq("user_id", user.id)
    .lt("log_date", today)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastDayRow) return fail("No previous day to copy.");

  const { data: entries } = await supabase
    .from("meal_logs")
    .select(
      "meal_slot, ingredient_id, user_food_id, custom_name, quantity_g, calories, protein_g, carbs_g, fat_g",
    )
    .eq("user_id", user.id)
    .eq("log_date", lastDayRow.log_date);
  if (!entries || entries.length === 0) return fail("No previous day to copy.");

  const { error } = await supabase.from("meal_logs").insert(
    entries.map((e) => ({
      user_id: user.id,
      log_date: today,
      meal_slot: e.meal_slot,
      ingredient_id: e.ingredient_id,
      user_food_id: e.user_food_id,
      custom_name: e.custom_name,
      quantity_g: e.quantity_g,
      calories: e.calories,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
      entry_method: "copy_yesterday",
    })),
  );
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { entry_method: "copy_yesterday", count: entries.length },
  });

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok({ copied: entries.length });
}

export async function removeMealLog(logId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function toggleFavoriteFood(
  ingredientId: string,
  favorite: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  // Favourites are keyed on the shared catalog — `food_favorites.ingredient_id`
  // is a NOT NULL foreign key to it. The diary hides the star on the user's own
  // foods; this is the matching refusal, so a direct POST gets a sentence
  // rather than a foreign-key violation.
  if (isUserFoodRef(ingredientId)) return fail("Your own foods can't be favourited.");

  const { error } = favorite
    ? (
        await supabase
          .from("food_favorites")
          .upsert({ user_id: user.id, ingredient_id: ingredientId }, { onConflict: "user_id,ingredient_id" })
      )
    : (
        await supabase
          .from("food_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("ingredient_id", ingredientId)
      );
  if (error) return fail(error.message);

  revalidatePath("/diet");
  return ok(undefined);
}
