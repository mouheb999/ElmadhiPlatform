"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { calculateMacros, type ActivityLevel, type DailySteps } from "@/lib/algorithms/macros";
import type { Goal, BodyFatLevel } from "@/lib/algorithms/diet-strategy";
import {
  fillTemplate,
  type DietConstraints,
  type Ingredient,
  type Slot,
  type TemplateSlot,
} from "@/lib/algorithms/meal-template-fill";
import { selectTemplate, type MealTemplate } from "@/lib/algorithms/meal-template-select";
import { swapQuantityG, type SwapFood } from "@/lib/algorithms/meal-swap";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type DietAnswers = {
  goal: Goal;
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  bodyFatLevel: BodyFatLevel;
  dailySteps: DailySteps;
  activityLevel: ActivityLevel;
  trainingDays: string; // "0" | "1_2" | "3_4" | "5_6" | "7"
  mealsPerDay: number; // 3 | 4 | 5
  trainingTime: string; // "morning" | "afternoon" | "evening" | "night" | "changes"
  budgetLevel: "low" | "medium" | "high";
  foodRestrictions: string[];
  avoidFoods: string[];
  cookingPref: string; // "fast" | "normal" | "mealprep" | "no_pref"
  digestion: string[];
  waterIntake: string;
  supplements: string[];
  trackingExperience: string;
};

function approximateBirthDate(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

/** Load the whole template catalog into the shapes the engine consumes. */
async function loadCatalog(supabase: Supa) {
  const [{ data: ingredients }, { data: templates }, { data: slots }] = await Promise.all([
    supabase
      .from("nutrition_ingredients")
      .select(
        "id, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, typical_serving_g, budget_tier, tags, is_slot_default",
      ),
    supabase.from("meal_templates").select("id, cooking_tier, budget_tier"),
    supabase
      .from("meal_template_slots")
      .select("template_id, meal_key, order_index, ingredient_id, role, is_optional")
      .order("order_index", { ascending: true }),
  ]);

  const ingList: Ingredient[] = (ingredients ?? []).map((i) => ({
    id: i.id,
    slot: i.slot as Slot,
    caloriesPer100g: i.calories_per_100g,
    proteinPer100g: i.protein_per_100g,
    carbsPer100g: i.carbs_per_100g,
    fatPer100g: i.fat_per_100g,
    typicalServingG: i.typical_serving_g,
    budgetTier: i.budget_tier as Ingredient["budgetTier"],
    tags: i.tags ?? [],
    isSlotDefault: i.is_slot_default,
  }));

  const byId = new Map<string, Ingredient>(ingList.map((i) => [i.id, i]));
  const bySlot = new Map<Slot, Ingredient[]>();
  for (const i of ingList) {
    const arr = bySlot.get(i.slot) ?? [];
    arr.push(i);
    bySlot.set(i.slot, arr);
  }

  const slotsByTemplate = new Map<string, TemplateSlot[]>();
  for (const s of slots ?? []) {
    const arr = slotsByTemplate.get(s.template_id) ?? [];
    arr.push({
      mealKey: s.meal_key as TemplateSlot["mealKey"],
      orderIndex: s.order_index,
      ingredientId: s.ingredient_id,
      role: s.role as TemplateSlot["role"],
      isOptional: s.is_optional,
    });
    slotsByTemplate.set(s.template_id, arr);
  }

  const templateList: MealTemplate[] = (templates ?? []).map((t) => ({
    id: t.id,
    cookingTier: t.cooking_tier as MealTemplate["cookingTier"],
    budgetTier: t.budget_tier as MealTemplate["budgetTier"],
  }));

  return { byId, bySlot, slotsByTemplate, templateList };
}

async function buildAndSaveMealPlan(
  supabase: Supa,
  userId: string,
  dietProfileId: string,
  answers: DietAnswers,
  macros: ReturnType<typeof calculateMacros>,
): Promise<string> {
  const { byId, bySlot, slotsByTemplate, templateList } = await loadCatalog(supabase);
  if (templateList.length === 0) throw new Error("No meal templates found — apply migration 028 first.");

  const constraints: DietConstraints = {
    budgetLevel: answers.budgetLevel,
    restrictions: answers.foodRestrictions.filter((r) => r !== "none"),
    avoidFoods: answers.avoidFoods,
    digestion: answers.digestion.filter((d) => d !== "none"),
    mealsPerDay: answers.mealsPerDay,
    trainingDays: answers.trainingDays,
  };

  const template = selectTemplate(templateList, slotsByTemplate, byId, constraints, answers.cookingPref);
  if (!template) throw new Error("Could not select a meal template.");

  const meals = fillTemplate(
    slotsByTemplate.get(template.id) ?? [],
    { calories: macros.calories, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG },
    byId,
    bySlot,
    constraints,
  );
  if (meals.every((m) => m.items.length === 0)) {
    throw new Error("The template could not be adapted to your constraints.");
  }

  await supabase.from("diet_profiles").update({ selected_template_code: template.id }).eq("id", dietProfileId);

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({ user_id: userId, diet_profile_id: dietProfileId, template_code: template.id })
    .select("id")
    .single();
  if (planError || !plan) throw new Error(planError?.message ?? "Failed to create meal plan.");

  try {
    for (const meal of meals) {
      const { data: mealRow, error: mealError } = await supabase
        .from("meal_plan_meals")
        .insert({ meal_plan_id: plan.id, meal_type: meal.mealKey, order_index: meal.orderIndex })
        .select("id")
        .single();
      if (mealError || !mealRow) throw new Error(mealError?.message ?? "Failed to create meal.");

      const { error: itemsError } = await supabase.from("meal_plan_items").insert(
        meal.items.map((item) => ({
          meal_id: mealRow.id,
          ingredient_id: item.ingredientId,
          quantity_g: item.quantityG,
          role: item.role,
          is_optional: item.isOptional,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    }
  } catch (e) {
    await supabase.from("meal_plans").delete().eq("id", plan.id);
    throw e;
  }

  return plan.id;
}

export async function submitDietQuestions(answers: DietAnswers): Promise<ActionResult<{ dietProfileId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  // Archive any existing active profile + plan (versioned, never deleted).
  const { data: previous } = await supabase
    .from("diet_profiles")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (previous) {
    await supabase.from("diet_profiles").update({ is_active: false }).eq("id", previous.id);
    await supabase.from("meal_plans").update({ is_active: false }).eq("diet_profile_id", previous.id);
  }

  const { data: dietProfile, error } = await supabase
    .from("diet_profiles")
    .insert({
      user_id: user.id,
      version: (previous?.version ?? 0) + 1,
      gender: answers.gender,
      birth_date: approximateBirthDate(answers.age),
      height_cm: answers.heightCm,
      weight_kg: answers.weightKg,
      target_weight_kg: answers.targetWeightKg,
      goal: answers.goal,
      body_fat_level: answers.bodyFatLevel,
      daily_steps: answers.dailySteps,
      activity_level: answers.activityLevel,
      training_days: answers.trainingDays,
      training_time: answers.trainingTime,
      meals_per_day: answers.mealsPerDay,
      budget_level: answers.budgetLevel,
      food_restrictions: answers.foodRestrictions,
      avoid_foods: answers.avoidFoods,
      cooking_pref: answers.cookingPref,
      digestion: answers.digestion,
      water_intake: answers.waterIntake,
      supplements: answers.supplements,
      tracking_experience: answers.trackingExperience,
    })
    .select("id")
    .single();

  if (error || !dietProfile) return fail(error?.message ?? "Could not save your answers.");

  const macros = calculateMacros({
    gender: answers.gender,
    birthDate: new Date(approximateBirthDate(answers.age)),
    heightCm: answers.heightCm,
    weightKg: answers.weightKg,
    activityLevel: answers.activityLevel,
    goal: answers.goal,
    bodyFatLevel: answers.bodyFatLevel,
    dailySteps: answers.dailySteps,
  });

  await supabase.from("macro_targets").insert({
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

  try {
    await buildAndSaveMealPlan(supabase, user.id, dietProfile.id, answers, macros);
  } catch (e) {
    console.error("[submitDietQuestions] meal plan build failed:", e);
    return fail(e instanceof Error ? e.message : "Could not generate your meal plan.");
  }

  return ok({ dietProfileId: dietProfile.id });
}

export async function saveMealPlanItemEdit(itemId: string, quantityG: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plan_items")
    .update({ quantity_g: quantityG, is_user_modified: true })
    .eq("id", itemId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function removeMealPlanItem(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_items").delete().eq("id", itemId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function addMealPlanItem(
  mealId: string,
  ingredientId: string,
  quantityG: number,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_items")
    .insert({ meal_id: mealId, ingredient_id: ingredientId, quantity_g: quantityG, is_user_modified: true })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Could not add food.");
  return ok({ id: data.id });
}

/**
 * Swap a planned food for a same-slot alternative, rescaling the portion so the
 * meal keeps its nutrition (see meal-swap.ts for what "same value" means here).
 * Grams are computed server-side from the catalog so a client can't post a
 * portion that doesn't match the food it claims to be swapping in.
 */
export async function swapMealPlanItem(
  itemId: string,
  newIngredientId: string,
): Promise<ActionResult<{ quantityG: number }>> {
  const supabase = await createClient();

  type MacroRow = {
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
  };

  const { data: itemRaw, error: itemError } = await supabase
    .from("meal_plan_items")
    .select(
      "quantity_g, nutrition_ingredients(calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) return fail(itemError.message);
  const item = itemRaw as unknown as { quantity_g: number; nutrition_ingredients: MacroRow | null } | null;
  if (!item?.nutrition_ingredients) return fail("Could not find the food to swap.");

  const { data: replacement, error: replacementError } = await supabase
    .from("nutrition_ingredients")
    .select("calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .eq("id", newIngredientId)
    .maybeSingle();
  if (replacementError) return fail(replacementError.message);
  if (!replacement) return fail("Could not find the replacement food.");

  const toSwapFood = (row: MacroRow): SwapFood => ({
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
  });

  const quantityG = swapQuantityG(
    toSwapFood(item.nutrition_ingredients),
    item.quantity_g,
    toSwapFood(replacement),
  );

  const { error } = await supabase
    .from("meal_plan_items")
    .update({ ingredient_id: newIngredientId, quantity_g: quantityG, is_user_modified: true })
    .eq("id", itemId);
  if (error) return fail(error.message);

  return ok({ quantityG });
}

export async function markMealPlanModified(planId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("meal_plans").update({ user_modified: true }).eq("id", planId);
}

export async function redoDietGoals() {
  redirect("/diet/questions?redo=1");
}
