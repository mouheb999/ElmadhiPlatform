import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getRedoQuota } from "@/lib/plan-redo";
import { RedoLimitCard } from "@/components/shared/redo-limit-card";
import { LoadFailure } from "@/components/shared/load-failure";
import { PlanBuilder } from "@/components/diet/plan-builder";
import { encodeFoodRef } from "@/lib/food-ref";
import type { IngredientOption } from "@/components/diet/ingredient-picker";

export const dynamic = "force-dynamic";

/**
 * The hand-built route into a meal plan.
 *
 * Crafting, not creating: the foods come from the same curated catalog the
 * generator draws on, plus whatever the user has added to their own list. What
 * changes is who decides which ones go where.
 *
 * The macro targets are still computed, from a short wizard covering the nine
 * answers the formula actually reads — see `createCustomMealPlan` for why those
 * are not user-typed.
 */
export default async function DietBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string }>;
}) {
  const [locale, { redo }] = await Promise.all([getLocale(), searchParams]);
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/diet/build");

  // Onboarding is never capped, rebuilding is. Checked here as well as in the
  // action so somebody out of rebuilds hears it before assembling a plan.
  if (redo) {
    const quota = await getRedoQuota(supabase, user.id, "diet");
    if (quota.remaining <= 0) {
      return (
        <div className="mx-auto max-w-lg">
          <RedoLimitCard locale={locale} limit={quota.limit} />
        </div>
      );
    }
  }

  const [
    { data: ingredientsRaw, error: ingredientsError },
    { data: userFoodsRaw, error: userFoodsError },
  ] = await Promise.all([
      supabase
        .from("nutrition_ingredients")
        .select(
          "id, name_en, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams, breakfast_ok",
        )
        .order("slot", { ascending: true }),
      supabase
        .from("user_foods")
        .select(
          "id, name, name_ar, slot, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_en, unit_en_plural, unit_ar, unit_ar_plural, unit_grams",
        )
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
    ]);

  // `user_foods` arrives with migration 043. Without it the builder would still
  // render — the catalog alone is enough to assemble a plan — and then fail at
  // the very end, on save, with a constraint error. Better to say so here.
  if (ingredientsError || userFoodsError) {
    return <LoadFailure detail={(ingredientsError ?? userFoodsError)?.message} />;
  }

  const foods: IngredientOption[] = [
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
      breakfastOk: true,
      isOwn: true,
    })),
  ];

  return (
    <div className="mx-auto max-w-lg">
      <PlanBuilder locale={locale} foods={foods} isRedo={!!redo} />
    </div>
  );
}
