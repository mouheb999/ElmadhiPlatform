"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { MacroRing } from "@/components/diet/macro-ring";
import { MealCard, type EditorItem } from "@/components/diet/meal-card";
import { WarningBanner } from "@/components/shared/warning-banner";
import { validateMealPlan } from "@/lib/algorithms/validation";
import { saveMealPlanItemEdit, removeMealPlanItem, addMealPlanItem, markMealPlanModified } from "@/app/actions/diet";
import { logFood, logPlanMeal, type MealSlot } from "@/app/actions/meal-logs";
import type { FoodResult } from "@/components/diet/food-search";
import { pick, type Locale } from "@/lib/i18n";

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
}: {
  locale: Locale;
  planId: string;
  target: { calories: number; proteinG: number; carbsG: number; fatG: number };
  initialMeals: EditorMeal[];
}) {
  const [meals, setMeals] = useState(initialMeals);
  const [logStatuses, setLogStatuses] = useState<Record<string, "pending" | "done">>({});
  const [itemLogStatuses, setItemLogStatuses] = useState<Record<string, "pending" | "done">>({});
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

  function handleAdd(mealId: string, food: FoodResult) {
    const tempId = `temp-${food.id}-${tempIdCounter.current++}`;
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
                  foodId: food.id,
                  nameEn: food.name_en,
                  nameAr: food.name_ar,
                  quantityG,
                  caloriesPer100g: food.calories_per_100g,
                  proteinPer100g: food.protein_per_100g,
                  carbsPer100g: food.carbs_per_100g,
                  fatPer100g: food.fat_per_100g,
                },
              ],
            }
          : m,
      ),
    );
    startTransition(async () => {
      const result = await addMealPlanItem(mealId, food.id, quantityG);
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

  function planTypeToSlot(mealType: string): MealSlot {
    if (mealType === "breakfast" || mealType === "lunch" || mealType === "dinner") return mealType;
    return "snack";
  }

  function handleLogItem(mealType: string, item: EditorItem) {
    setItemLogStatuses((prev) => ({ ...prev, [item.id]: "pending" }));
    startTransition(async () => {
      const result = await logFood({
        slot: planTypeToSlot(mealType),
        foodId: item.foodId,
        quantityG: item.quantityG,
        entryMethod: "plan",
      });
      setItemLogStatuses((prev) => {
        const next = { ...prev };
        if (result.ok) next[item.id] = "done";
        else delete next[item.id];
        return next;
      });
    });
  }

  function handleLogMeal(mealId: string) {
    setLogStatuses((prev) => ({ ...prev, [mealId]: "pending" }));
    startTransition(async () => {
      const result = await logPlanMeal(mealId);
      setLogStatuses((prev) => {
        const next = { ...prev };
        if (result.ok) next[mealId] = "done";
        else delete next[mealId];
        return next;
      });
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
            defaultOpen={i === 0}
            onQuantityChange={(itemId, qty) => handleQuantityChange(meal.id, itemId, qty)}
            onRemove={(itemId) => handleRemove(meal.id, itemId)}
            onAdd={(food) => handleAdd(meal.id, food)}
            onLogMeal={() => handleLogMeal(meal.id)}
            logStatus={logStatuses[meal.id] ?? "idle"}
            onLogItem={(item) => handleLogItem(meal.mealType, item)}
            itemLogStatuses={itemLogStatuses}
          />
        ))}
      </div>
    </div>
  );
}
