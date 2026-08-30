"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlanUser } from "@/lib/subscription-server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getRedoQuota, MONTHLY_REDO_LIMIT, REDO_QUOTA_ERROR } from "@/lib/plan-redo";
import { MAX_ITEMS_PER_MEAL, MAX_QUANTITY_G } from "@/lib/program-limits";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { calculateMacros, isUsableBodyFatPercent, type ActivityLevel } from "@/lib/algorithms/macros";
import type { Goal } from "@/lib/algorithms/diet-strategy";

/**
 * The other way to get a meal plan: choose the food yourself.
 *
 * Crafting, not creating from nothing. The 20-question wizard exists because
 * most people cannot answer "what should I eat" — but a meaningful number can,
 * and for them the wizard produces a template they immediately start pulling
 * apart, one swap at a time, to arrive at the food they were always going to eat.
 *
 * Two things are deliberately NOT user-supplied here:
 *
 *   1. The macro targets. Those still come out of `calculateMacros`, from the
 *      nine answers the formula actually reads. Letting somebody type their own
 *      calorie number would skip the floors in that function (1200 kcal, 0.5 g/kg
 *      fat) and hand the coaching loop a target it cannot reason about — every
 *      adaptation, every weekly review and the whole of /progress is written
 *      against a computed target.
 *
 *   2. The macros of each food. Grams are what the client sends; kcal/protein/
 *      carbs/fat are looked up server-side, exactly as the guided plan and the
 *      diary already do.
 *
 * Everything lands in meal_plans / meal_plan_meals / meal_plan_items, so the
 * diary, the plan view, "log this meal" and the swap picker all keep working
 * without knowing which route produced the rows.
 */

/** The answers `calculateMacros` reads. Nothing else is asked. */
export type DietEssentials = {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  /**
   * Optional, and the only body-fat input that moves a number: a measured
   * percentage swaps Mifflin-St Jeor for a lean-mass RMR. The old
   * `bodyFatLevel` / `dailySteps` fields are gone — the simplified calculator
   * uses neither, and asking for an answer nothing reads is worse than not
   * asking.
   */
  bodyFatPercent: number | null;
};

export type CustomMealInput = {
  /** One of the template meal keys — the diary is keyed on these. */
  mealKey: string;
  items: { ingredientId?: string; userFoodId?: string; quantityG: number }[];
};

export type CustomPlanInput = {
  essentials: DietEssentials;
  meals: CustomMealInput[];
};

/**
 * The eating occasions a plan can be built from.
 *
 * Same list as `meal_template_slots.meal_key` and the same list `meal_logs`
 * accepts, because a plan meal and a diary entry have to line up 1:1 — that
 * alignment is what makes "log this whole meal" a single tap.
 */
const MEAL_KEYS = [
  "meal_1",
  "snack",
  "meal_2",
  "meal_3",
  "pre_workout",
  "post_workout",
  "last_meal",
] as const;

const MIN_MEALS = 1;
const MAX_MEALS = MEAL_KEYS.length;

const GOALS: Goal[] = ["lose_fat", "maintain", "build_muscle", "recomp"];
const ACTIVITY: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];

/**
 * Ranges wide enough to hold any real person and narrow enough that the macro
 * formula cannot be driven somewhere absurd. Mifflin-St Jeor is linear in all
 * three, so an unbounded height or weight is an unbounded calorie target.
 */
function validEssentials(e: DietEssentials): string | null {
  if (e.gender !== "male" && e.gender !== "female") return "Pick male or female.";
  if (!Number.isFinite(e.age) || e.age < 14 || e.age > 90) return "Age looks off.";
  if (!Number.isFinite(e.heightCm) || e.heightCm < 120 || e.heightCm > 230) return "Height looks off.";
  if (!Number.isFinite(e.weightKg) || e.weightKg < 30 || e.weightKg > 300) return "Weight looks off.";
  if (!Number.isFinite(e.targetWeightKg) || e.targetWeightKg < 30 || e.targetWeightKg > 300) {
    return "Target weight looks off.";
  }
  if (!GOALS.includes(e.goal)) return "Pick a goal.";
  if (!ACTIVITY.includes(e.activityLevel)) return "Pick an activity level.";
  // Optional, but a number that IS given has to be a believable one — it is
  // about to replace the whole resting-energy formula.
  if (e.bodyFatPercent !== null && !isUsableBodyFatPercent(e.bodyFatPercent)) {
    return "Body fat % looks off — leave it empty if you don't know it.";
  }
  return null;
}

function approximateBirthDate(age: number): string {
  return `${new Date().getFullYear() - Math.round(age)}-01-01`;
}

/**
 * Free, matching every other plan-building action. Bounded by the same monthly
 * rebuild quota, counted in the same place.
 */
export async function createCustomMealPlan(
  input: CustomPlanInput,
): Promise<ActionResult<{ dietProfileId: string; planId: string }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePlanUser();
  if (!user) return fail(denied);

  const essentialsError = validEssentials(input.essentials);
  if (essentialsError) return fail(essentialsError);

  const meals = Array.isArray(input.meals) ? input.meals : [];
  if (meals.length < MIN_MEALS || meals.length > MAX_MEALS) {
    return fail(`A plan needs between ${MIN_MEALS} and ${MAX_MEALS} meals.`);
  }

  const seenKeys = new Set<string>();
  for (const meal of meals) {
    if (!(MEAL_KEYS as readonly string[]).includes(meal?.mealKey)) {
      return fail("One of the meals isn't a slot we recognise.");
    }
    // Two meals sharing a key would collide in the diary, where a logged entry
    // is filed under its slot and nothing else.
    if (seenKeys.has(meal.mealKey)) return fail("Two meals are using the same slot.");
    seenKeys.add(meal.mealKey);

    const items = Array.isArray(meal.items) ? meal.items : [];
    if (items.length === 0) return fail("Every meal needs at least one food.");
    if (items.length > MAX_ITEMS_PER_MEAL) {
      return fail(`A meal can hold at most ${MAX_ITEMS_PER_MEAL} foods.`);
    }
    for (const item of items) {
      const hasIngredient = typeof item?.ingredientId === "string" && item.ingredientId.length > 0;
      const hasUserFood = typeof item?.userFoodId === "string" && item.userFoodId.length > 0;
      // Mirrors the CHECK added in migration 043; caught here so it reads as a
      // sentence rather than a constraint name.
      if (hasIngredient === hasUserFood) return fail("A food row must name exactly one food.");

      const quantity = Number(item.quantityG);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY_G) {
        return fail("One of the portions looks off.");
      }
    }
  }

  // ---- every id must exist, and a user food must be this user's ----
  const ingredientIds = [
    ...new Set(meals.flatMap((m) => m.items.map((i) => i.ingredientId).filter(Boolean) as string[])),
  ];
  const userFoodIds = [
    ...new Set(meals.flatMap((m) => m.items.map((i) => i.userFoodId).filter(Boolean) as string[])),
  ];

  const [{ data: ingredients }, { data: userFoods }] = await Promise.all([
    ingredientIds.length
      ? supabase.from("nutrition_ingredients").select("id").eq("in_catalog", true).in("id", ingredientIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    // Scoped to the caller explicitly as well as by RLS: this is the check that
    // stops somebody pasting another account's food id into their own plan and
    // reading its name and macros back through the join.
    userFoodIds.length
      ? supabase
          .from("user_foods")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .in("id", userFoodIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  if ((ingredients ?? []).length !== ingredientIds.length) {
    return fail("One of the foods is no longer in the catalog.");
  }
  if ((userFoods ?? []).length !== userFoodIds.length) {
    return fail("One of your own foods could not be found.");
  }

  // ---- archive whatever is active, under the same quota as the wizard ----
  const { data: previous } = await supabase
    .from("diet_profiles")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (previous) {
    const quota = await getRedoQuota(supabase, user.id, "diet");
    if (quota.remaining <= 0) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(quota.limit)));
    }
    await supabase.from("diet_profiles").update({ is_active: false }).eq("id", previous.id);
    await supabase.from("meal_plans").update({ is_active: false }).eq("diet_profile_id", previous.id);
  }

  const e = input.essentials;
  const { data: dietProfile, error: profileError } = await supabase
    .from("diet_profiles")
    .insert({
      user_id: user.id,
      version: (previous?.version ?? 0) + 1,
      build_mode: "custom",
      gender: e.gender,
      birth_date: approximateBirthDate(e.age),
      height_cm: e.heightCm,
      weight_kg: e.weightKg,
      target_weight_kg: e.targetWeightKg,
      goal: e.goal,
      body_fat_percent: e.bodyFatPercent,
      activity_level: e.activityLevel,
      meals_per_day: meals.length,
      // The other sixteen answers only ever fed template selection and slot
      // filling. Nothing is selecting or filling here, so they stay null rather
      // than being invented.
    })
    .select("id")
    .single();

  if (profileError || !dietProfile) {
    if (profileError?.message.includes(REDO_QUOTA_ERROR)) {
      const locale = await getLocale();
      return fail(t(locale, "redo.quota_blocked").replace("{total}", String(MONTHLY_REDO_LIMIT)));
    }
    return fail(profileError?.message ?? "Could not save your answers.");
  }

  const macros = calculateMacros({
    gender: e.gender,
    birthDate: new Date(approximateBirthDate(e.age)),
    heightCm: e.heightCm,
    weightKg: e.weightKg,
    activityLevel: e.activityLevel,
    goal: e.goal,
    bodyFatPercent: e.bodyFatPercent,
  });

  const { error: macroError } = await supabase.from("macro_targets").insert({
    diet_profile_id: dietProfile.id,
    bmr: macros.bmr,
    tdee: macros.tdee,
    calories: macros.calories,
    protein_g: macros.proteinG,
    carbs_g: macros.carbsG,
    fat_g: macros.fatG,
    fiber_g: macros.fiberG,
    rationale_json: macros.rationale,
  });
  if (macroError) {
    await rollback(createAdminClient(), dietProfile.id, null, previous?.id);
    return fail(macroError.message);
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      diet_profile_id: dietProfile.id,
      // No template_code: this plan was not derived from one, and pointing it at
      // a template would make /diet/rationale explain a plan nobody generated.
      is_custom: true,
      user_modified: true,
    })
    .select("id")
    .single();
  if (planError || !plan) {
    await rollback(createAdminClient(), dietProfile.id, null, previous?.id);
    return fail(planError?.message ?? "Could not create your plan.");
  }

  for (const [index, meal] of meals.entries()) {
    const { data: mealRow, error: mealError } = await supabase
      .from("meal_plan_meals")
      .insert({ meal_plan_id: plan.id, meal_type: meal.mealKey, order_index: index })
      .select("id")
      .single();
    if (mealError || !mealRow) {
      await rollback(createAdminClient(), dietProfile.id, plan.id, previous?.id);
      return fail(mealError?.message ?? "Could not create a meal.");
    }

    const { error: itemsError } = await supabase.from("meal_plan_items").insert(
      meal.items.map((item) => ({
        meal_id: mealRow.id,
        ingredient_id: item.ingredientId ?? null,
        user_food_id: item.userFoodId ?? null,
        quantity_g: Math.round(Number(item.quantityG)),
        is_user_modified: true,
      })),
    );
    if (itemsError) {
      await rollback(createAdminClient(), dietProfile.id, plan.id, previous?.id);
      return fail(itemsError.message);
    }
  }

  revalidatePath("/diet");
  revalidatePath("/dashboard");
  return ok({ dietProfileId: dietProfile.id, planId: plan.id });
}

/**
 * Undo a partial build and put the previous plan back.
 *
 * Same reasoning as the workout builder: there is no transaction spanning
 * separate PostgREST calls, and a diet profile with no meal plan behind it
 * sends /diet straight to the questionnaire — the user's old plan gone and no
 * new one to show for it.
 *
 * Runs on the service-role client because migration 045 revoked DELETE on
 * `diet_profiles` from users — the monthly rebuild quota is counted from those
 * rows, so being able to delete them was being able to reset the allowance.
 * Every id it touches was created by this function moments ago.
 */
async function rollback(
  supabase: ReturnType<typeof createAdminClient>,
  dietProfileId: string,
  planId: string | null,
  previousProfileId: string | undefined,
): Promise<void> {
  if (planId) await supabase.from("meal_plans").delete().eq("id", planId);
  await supabase.from("macro_targets").delete().eq("diet_profile_id", dietProfileId);
  await supabase.from("diet_profiles").delete().eq("id", dietProfileId);
  if (previousProfileId) {
    await supabase.from("diet_profiles").update({ is_active: true }).eq("id", previousProfileId);
    await supabase.from("meal_plans").update({ is_active: true }).eq("diet_profile_id", previousProfileId);
  }
}

// ---------------------------------------------------------------------------
// The user's own foods
// ---------------------------------------------------------------------------

export type UserFoodInput = {
  name: string;
  slot: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

const SLOTS = ["protein", "carb", "vegetable", "fat", "fruit", "legume", "beverage"];

/**
 * Ceiling on one account's private food list.
 *
 * This is the only table in the app a signed-in user can insert unbounded rows
 * into — a plan and a diary day are both capped by their own shape. The unique
 * index on (user, name) stops the same food twice but not a script varying the
 * name. Two hundred is more foods than anyone eats and far more than the picker
 * can usefully list.
 */
const MAX_USER_FOODS = 200;

/**
 * "The thing I eat isn't in your list."
 *
 * The catalog is forty curated ingredients with checked per-100g values, and it
 * is global and read-only — which is right for a reference set and useless the
 * moment somebody's staple isn't in it. This writes a private row instead, in
 * the same shape, so one picker can list both and the diary can log either.
 *
 * The numbers are whatever the user copied off a packet. They are bounded
 * (migration 043) rather than verified, because there is nothing to verify them
 * against; what matters is that a bad number can only ever affect the account
 * that typed it.
 */
export async function createUserFood(
  input: UserFoodInput,
): Promise<ActionResult<{ id: string }>> {
  const { user, denied } = await requirePlanUser();
  if (!user) return fail(denied);

  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return fail("Give the food a name.");
  if (!SLOTS.includes(input.slot)) return fail("Pick what kind of food it is.");

  const calories = Number(input.caloriesPer100g);
  const protein = Number(input.proteinPer100g);
  const carbs = Number(input.carbsPer100g);
  const fat = Number(input.fatPer100g);

  for (const value of [calories, protein, carbs, fat]) {
    if (!Number.isFinite(value) || value < 0) return fail("Those numbers don't look right.");
  }
  if (calories > 900) return fail("Nothing has more than 900 kcal per 100 g.");
  if (protein > 100 || carbs > 100 || fat > 100) return fail("Those numbers don't look right.");
  // 100 g of food cannot contain more than 100 g of macronutrient. This is the
  // check that catches a per-serving label typed into per-100g fields.
  if (protein + carbs + fat > 100) {
    const locale = await getLocale();
    return fail(t(locale, "uf.macros_exceed"));
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("user_foods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_archived", false);
  if ((count ?? 0) >= MAX_USER_FOODS) {
    return fail("Your food list is full — archive a few you no longer use.");
  }

  const { data, error } = await supabase
    .from("user_foods")
    .insert({
      user_id: user.id,
      name,
      slot: input.slot,
      calories_per_100g: Math.round(calories * 10) / 10,
      protein_per_100g: Math.round(protein * 10) / 10,
      carbs_per_100g: Math.round(carbs * 10) / 10,
      fat_per_100g: Math.round(fat * 10) / 10,
    })
    .select("id")
    .single();

  if (error) {
    // The partial unique index from migration 043 — they already have this one.
    if (error.code === "23505") return fail("You've already added a food with that name.");
    return fail(error.message);
  }
  if (!data) return fail("Could not add that food.");

  revalidatePath("/diet");
  return ok({ id: data.id });
}

/**
 * Hide a user food rather than delete it.
 *
 * It may be sitting in the active plan and in months of logged days. Deleting
 * would cascade the plan rows away and blank the name on every diary entry that
 * used it (migration 043 chose SET NULL there deliberately); archiving takes it
 * out of the picker and leaves the record intact.
 */
export async function archiveUserFood(foodId: string): Promise<ActionResult> {
  const { user, denied } = await requirePlanUser();
  if (!user) return fail(denied);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_foods")
    .update({ is_archived: true })
    .eq("id", foodId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/diet");
  return ok(undefined);
}
