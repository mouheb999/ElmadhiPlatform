"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** Entry paths a user can trigger today (barcode/voice/camera are V3).
 *  "plan" = a single item taken from the generated meal plan; it's stored as
 *  the DB's 'template' method since the plan is the user's meal template. */
const MANUAL_ENTRY_METHODS = ["search", "recent", "favorite", "plan"] as const;
type ManualEntryMethod = (typeof MANUAL_ENTRY_METHODS)[number];

function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Log a catalog food. Macros are computed server-side from the foods table
 * (never trusted from the client) and denormalized onto the log row so the
 * entry survives later food edits.
 */
export async function logFood(input: {
  slot: MealSlot;
  foodId: string;
  quantityG: number;
  entryMethod: ManualEntryMethod;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (!MEAL_SLOTS.includes(input.slot)) return fail("Unknown meal slot.");
  if (!MANUAL_ENTRY_METHODS.includes(input.entryMethod)) return fail("Unknown entry method.");
  const quantity = Number(input.quantityG);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
    return fail("Quantity looks off — please double-check.");
  }

  const { data: food } = await supabase
    .from("foods")
    .select("id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .eq("id", input.foodId)
    .maybeSingle();
  if (!food) return fail("Food not found.");

  const factor = quantity / 100;
  const { error } = await supabase.from("meal_logs").insert({
    user_id: user.id,
    log_date: serverToday(),
    meal_slot: input.slot,
    food_id: food.id,
    quantity_g: quantity,
    calories: Math.round((food.calories_per_100g ?? 0) * factor * 10) / 10,
    protein_g: Math.round((food.protein_per_100g ?? 0) * factor * 10) / 10,
    carbs_g: Math.round((food.carbs_per_100g ?? 0) * factor * 10) / 10,
    fat_g: Math.round((food.fat_per_100g ?? 0) * factor * 10) / 10,
    entry_method: input.entryMethod === "plan" ? "template" : input.entryMethod,
  });
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot: input.slot, entry_method: input.entryMethod },
  });

  revalidatePath("/diet/log");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/** Plan meal_type → diary slot (snack_1/snack_2 both land in "snack"). */
function planTypeToSlot(mealType: string): MealSlot {
  if (mealType === "breakfast" || mealType === "lunch" || mealType === "dinner") return mealType;
  return "snack";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  type PlanMealRow = {
    id: string;
    meal_type: string;
    meal_plans: { user_id: string } | null;
    meal_plan_items: {
      food_id: string | null;
      quantity_g: number;
      foods: {
        calories_per_100g: number | null;
        protein_per_100g: number | null;
        carbs_per_100g: number | null;
        fat_per_100g: number | null;
      } | null;
    }[];
  };

  const { data: mealRaw } = await supabase
    .from("meal_plan_meals")
    .select(
      "id, meal_type, meal_plans!inner(user_id), meal_plan_items(food_id, quantity_g, foods(calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g))",
    )
    .eq("id", mealId)
    .eq("meal_plans.user_id", user.id)
    .maybeSingle();
  if (!mealRaw) return fail("Meal not found.");

  const meal = mealRaw as unknown as PlanMealRow;
  const items = (meal.meal_plan_items ?? []).filter((i) => i.foods);
  if (items.length === 0) return fail("This meal has no foods yet.");

  const slot = planTypeToSlot(meal.meal_type);
  const today = serverToday();

  const { error } = await supabase.from("meal_logs").insert(
    items.map((item) => {
      const factor = (item.quantity_g ?? 0) / 100;
      return {
        user_id: user.id,
        log_date: today,
        meal_slot: slot,
        food_id: item.food_id,
        quantity_g: item.quantity_g,
        calories: Math.round((item.foods!.calories_per_100g ?? 0) * factor * 10) / 10,
        protein_g: Math.round((item.foods!.protein_per_100g ?? 0) * factor * 10) / 10,
        carbs_g: Math.round((item.foods!.carbs_per_100g ?? 0) * factor * 10) / 10,
        fat_g: Math.round((item.foods!.fat_per_100g ?? 0) * factor * 10) / 10,
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

  revalidatePath("/diet/log");
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  if (!MEAL_SLOTS.includes(input.slot)) return fail("Unknown meal slot.");
  const calories = Number(input.calories);
  if (!Number.isFinite(calories) || calories <= 0 || calories > 10000) {
    return fail("Calories look off — please double-check.");
  }

  const { error } = await supabase.from("meal_logs").insert({
    user_id: user.id,
    log_date: serverToday(),
    meal_slot: input.slot,
    custom_name: input.name.trim() || null,
    calories,
    protein_g: input.proteinG ?? 0,
    carbs_g: input.carbsG ?? 0,
    fat_g: input.fatG ?? 0,
    entry_method: "quick",
  });
  if (error) return fail(error.message);

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "meal_logged",
    payload: { slot: input.slot, entry_method: "quick" },
  });

  revalidatePath("/diet/log");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/** Copy every entry from the most recent logged day (usually yesterday). */
export async function copyPreviousDay(): Promise<ActionResult<{ copied: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

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
    .select("meal_slot, food_id, custom_name, quantity_g, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .eq("log_date", lastDayRow.log_date);
  if (!entries || entries.length === 0) return fail("No previous day to copy.");

  const { error } = await supabase.from("meal_logs").insert(
    entries.map((e) => ({
      user_id: user.id,
      log_date: today,
      meal_slot: e.meal_slot,
      food_id: e.food_id,
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

  revalidatePath("/diet/log");
  revalidatePath("/dashboard");
  return ok({ copied: entries.length });
}

export async function removeMealLog(logId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/diet/log");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function toggleFavoriteFood(
  foodId: string,
  favorite: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { error } = favorite
    ? (
        await supabase
          .from("food_favorites")
          .upsert({ user_id: user.id, food_id: foodId }, { onConflict: "user_id,food_id" })
      )
    : (
        await supabase
          .from("food_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("food_id", foodId)
      );
  if (error) return fail(error.message);

  revalidatePath("/diet/log");
  return ok(undefined);
}
