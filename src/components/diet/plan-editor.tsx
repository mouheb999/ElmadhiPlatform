"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { MacroRing } from "@/components/diet/macro-ring";
import { MealCard, type EditorItem } from "@/components/diet/meal-card";
import { WarningBanner } from "@/components/shared/warning-banner";
import { validateMealPlan } from "@/lib/algorithms/validation";
import {
  saveMealPlanItemEdit,
  removeMealPlanItem,
  addMealPlanItem,
  markMealPlanModified,
  swapMealPlanItem,
} from "@/app/actions/diet";
import { swapQuantityG } from "@/lib/algorithms/meal-swap";
import type { IngredientOption } from "@/components/diet/ingredient-picker";
import type { ServingUnit } from "@/lib/servings";
import { pick, type Locale } from "@/lib/i18n";

/**
 * The serving-unit half of a catalog entry. Added or swapped-in foods have to
 * carry it too, or the row would fall back to bare grams until the next reload.
 */
function servingUnitOf(ing: IngredientOption): ServingUnit {
  return {
    unitEn: ing.unitEn,
    unitEnPlural: ing.unitEnPlural,
    unitAr: ing.unitAr,
    unitArPlural: ing.unitArPlural,
    unitGrams: ing.unitGrams,
  };
}

export type EditorMeal = {
  id: string;
  mealType: string;
  items: EditorItem[];
};

export function PlanEditor({
  locale,
  planId,
  target,
  initialMeals,
  ingredients,
}: {
  locale: Locale;
  planId: string;
  target: { calories: number; proteinG: number; carbsG: number; fatG: number };
  initialMeals: EditorMeal[];
  ingredients: IngredientOption[];
}) {
  const [meals, setMeals] = useState(initialMeals);
  const [, startTransition] = useTransition();
  const tempIdCounter = useRef(0);

  const totals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const meal of meals) {
      for (const item of meal.items) {
        const factor = item.quantityG / 100;
        calories += item.caloriesPer100g * factor;
        proteinG += item.proteinPer100g * factor;
        carbsG += item.carbsPer100g * factor;
        fatG += item.fatPer100g * factor;
      }
    }
    return { calories, proteinG, carbsG, fatG };
  }, [meals]);

  const warnings = useMemo(
    () => validateMealPlan({ calories: totals.calories, proteinG: totals.proteinG, carbsG: totals.carbsG, fatG: totals.fatG }, target),
    [totals, target],
  );

  function persist(mutate: () => void) {
    mutate();
    startTransition(() => {
      markMealPlanModified(planId);
    });
  }

  function handleQuantityChange(mealId: string, itemId: string, quantityG: number) {
    setMeals((prev) =>
      prev.map((m) => (m.id === mealId ? { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, quantityG } : i)) } : m)),
    );
    persist(() => {
      saveMealPlanItemEdit(itemId, quantityG);
    });
  }

  function handleRemove(mealId: string, itemId: string) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m)));
    persist(() => {
      removeMealPlanItem(itemId);
    });
  }

  function handleAdd(mealId: string, ing: IngredientOption) {
    const tempId = `temp-${ing.id}-${tempIdCounter.current++}`;
    const quantityG = 100;
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: [
                ...m.items,
                {
                  id: tempId,
                  ingredientId: ing.id,
                  nameEn: ing.nameEn,
                  nameAr: ing.nameAr,
                  slot: ing.slot,
                  quantityG,
                  caloriesPer100g: ing.caloriesPer100g,
                  proteinPer100g: ing.proteinPer100g,
                  carbsPer100g: ing.carbsPer100g,
                  fatPer100g: ing.fatPer100g,
                  imageUrl: ing.imageUrl,
                  ...servingUnitOf(ing),
                },
              ],
            }
          : m,
      ),
    );
    startTransition(async () => {
      const result = await addMealPlanItem(mealId, ing.id, quantityG);
      if (result.ok) {
        setMeals((prev) =>
          prev.map((m) =>
            m.id === mealId ? { ...m, items: m.items.map((i) => (i.id === tempId ? { ...i, id: result.data.id } : i)) } : m,
          ),
        );
      }
      markMealPlanModified(planId);
    });
  }

  /**
   * Swap optimistically at the same portion the server will compute (both sides
   * call swapQuantityG), then reconcile with the authoritative grams it returns.
   */
  function handleSwap(mealId: string, item: EditorItem, replacement: IngredientOption) {
    const quantityG = swapQuantityG(item, item.quantityG, replacement);
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      ingredientId: replacement.id,
                      nameEn: replacement.nameEn,
                      nameAr: replacement.nameAr,
                      slot: replacement.slot,
                      quantityG,
                      caloriesPer100g: replacement.caloriesPer100g,
                      proteinPer100g: replacement.proteinPer100g,
                      carbsPer100g: replacement.carbsPer100g,
                      fatPer100g: replacement.fatPer100g,
                      imageUrl: replacement.imageUrl,
                      ...servingUnitOf(replacement),
                    }
                  : i,
              ),
            }
          : m,
      ),
    );
    startTransition(async () => {
      const result = await swapMealPlanItem(item.id, replacement.id);
      if (result.ok && result.data.quantityG !== quantityG) {
        setMeals((prev) =>
          prev.map((m) =>
            m.id === mealId
              ? { ...m, items: m.items.map((i) => (i.id === item.id ? { ...i, quantityG: result.data.quantityG } : i)) }
              : m,
          ),
        );
      }
      markMealPlanModified(planId);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <MacroRing
        calories={totals.calories}
        caloriesTarget={target.calories}
        proteinG={totals.proteinG}
        proteinTargetG={target.proteinG}
        carbsG={totals.carbsG}
        carbsTargetG={target.carbsG}
        fatG={totals.fatG}
        fatTargetG={target.fatG}
        dailyTargetLabel={locale === "tn" ? "الهدف اليومي" : "Daily target"}
      />

      {warnings.map((w) => (
        <WarningBanner key={w.type} message={pick(locale, w.message.en, w.message.ar)} />
      ))}

      <div className="flex flex-col gap-3">
        {meals.map((meal, i) => (
          <MealCard
            key={meal.id}
            locale={locale}
            mealType={meal.mealType}
            items={meal.items}
            ingredients={ingredients}
            defaultOpen={i === 0}
            onQuantityChange={(itemId, qty) => handleQuantityChange(meal.id, itemId, qty)}
            onRemove={(itemId) => handleRemove(meal.id, itemId)}
            onAdd={(food) => handleAdd(meal.id, food)}
            onSwap={(item, replacement) => handleSwap(meal.id, item, replacement)}
          />
        ))}
      </div>
    </div>
  );
}
