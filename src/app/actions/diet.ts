"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { calculateMacros, type ActivityLevel } from "@/lib/algorithms/macros";
import type { Goal, DietIntensity } from "@/lib/algorithms/diet-strategy";
import { generateMealPlan, type FoodCandidate } from "@/lib/algorithms/meal-plan-gen";

export type DietAnswers = {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  mealsPerDay: number;
  budgetLevel: "low" | "medium" | "high";
  allergies: string[];
  dietaryRestriction: string;
  dislikedFoodIds: string[];
};

function approximateBirthDate(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

async function buildAndSaveMealPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dietProfileId: string,
  answers: DietAnswers,
  macros: ReturnType<typeof calculateMacros>,
) {
  const { data: foods, error: foodsError } = await supabase
    .from("foods")
    .select("id, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, allergens, tags, price_tier, is_common");
  if (foodsError) throw new Error(foodsError.message);

  const meals = generateMealPlan(
    { calories: macros.calories, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG },
    answers.mealsPerDay,
    (foods ?? []) as FoodCandidate[],
    {
      allergies: answers.allergies,
      dietaryRestriction: answers.dietaryRestriction === "none" ? null : answers.dietaryRestriction,
      budgetLevel: answers.budgetLevel,
      dislikedFoodIds: answers.dislikedFoodIds,
      favoriteFoodIds: [],
    },
  );

  // An all-empty plan means the food catalog can't satisfy the constraints;
  // saving it would leave the plan/diary screens showing nothing.
  if (meals.every((meal) => meal.items.length === 0)) {
    throw new Error("No foods in the catalog match your constraints — the plan could not be generated.");
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({ user_id: userId, diet_profile_id: dietProfileId })
    .select("id")
    .single();
  if (planError || !plan) throw new Error(planError?.message ?? "Failed to create meal plan.");

  try {
    for (const [index, meal] of meals.entries()) {
      const { data: mealRow, error: mealError } = await supabase
        .from("meal_plan_meals")
        .insert({ meal_plan_id: plan.id, meal_type: meal.mealType, order_index: index })
        .select("id")
        .single();
      if (mealError || !mealRow) throw new Error(mealError?.message ?? "Failed to create meal.");

      if (meal.items.length > 0) {
        const { error: itemsError } = await supabase.from("meal_plan_items").insert(
          meal.items.map((item) => ({
            meal_id: mealRow.id,
            food_id: item.foodId,
            quantity_g: item.quantityG,
          })),
        );
        if (itemsError) throw new Error(itemsError.message);
      }
    }
  } catch (e) {
    // Don't leave a half-written active plan behind (cascade removes meals/items).
    await supabase.from("meal_plans").delete().eq("id", plan.id);
    throw e;
  }

  return plan.id;
}

export async function submitDietQuestions(answers: DietAnswers): Promise<ActionResult<{ dietProfileId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  // Archive any existing active plan (versioned, never deleted).
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
      goal: answers.goal,
      activity_level: answers.activityLevel,
      meals_per_day: answers.mealsPerDay,
      budget_level: answers.budgetLevel,
      allergies: answers.allergies,
      dietary_restriction: answers.dietaryRestriction,
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
    dietIntensity: "normal",
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
    return fail(e instanceof Error ? e.message : "Could not generate your meal plan.");
  }

  return ok({ dietProfileId: dietProfile.id });
}

/** Rule D1 — recompute the calorie target at a different intensity, opt-in only. */
export async function updateDietIntensity(dietProfileId: string, intensity: DietIntensity): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { data: profile } = await supabase
    .from("diet_profiles")
    .select("*")
    .eq("id", dietProfileId)
    .eq("user_id", user.id)
    .single();
  if (!profile) return fail("Plan not found.");

  await supabase.from("diet_profiles").update({ diet_intensity: intensity }).eq("id", dietProfileId);

  const macros = calculateMacros({
    gender: (profile.gender as "male" | "female") ?? "male",
    birthDate: new Date(profile.birth_date ?? "2000-01-01"),
    heightCm: profile.height_cm ?? 170,
    weightKg: profile.weight_kg ?? 70,
    activityLevel: (profile.activity_level as ActivityLevel) ?? "moderate",
    goal: (profile.goal as Goal) ?? "maintain",
    dietIntensity: intensity,
  });

  await supabase
    .from("macro_targets")
    .update({
      bmr: macros.bmr,
      tdee: macros.tdee,
      calories: macros.calories,
      protein_g: macros.proteinG,
      carbs_g: macros.carbsG,
      fat_g: macros.fatG,
      fiber_g: macros.fiberG,
      rationale_json: macros.rationale,
    })
    .eq("diet_profile_id", dietProfileId);

  return ok(undefined);
}

export async function saveMealPlanItemEdit(
  itemId: string,
  quantityG: number,
): Promise<ActionResult> {
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
  foodId: string,
  quantityG: number,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_items")
    .insert({ meal_id: mealId, food_id: foodId, quantity_g: quantityG, is_user_modified: true })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Could not add food.");
  return ok({ id: data.id });
}

export async function markMealPlanModified(planId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("meal_plans").update({ user_modified: true }).eq("id", planId);
}

export async function redoDietGoals() {
  redirect("/diet/questions?redo=1");
}
