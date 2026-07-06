"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, NotebookPen, Plus, Trash2 } from "lucide-react";
import { pick, t, type Locale } from "@/lib/i18n";
import { FoodSearch, type FoodResult } from "@/components/diet/food-search";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EditorItem = {
  id: string;
  foodId: string;
  nameEn: string | null;
  nameAr: string;
  quantityG: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

const MEAL_LABELS: Record<string, { en: string; ar: string }> = {
  breakfast: { en: "Breakfast", ar: "الفطور" },
  lunch: { en: "Lunch", ar: "الغدا" },
  dinner: { en: "Dinner", ar: "العشا" },
  snack_1: { en: "Snack", ar: "وجبة خفيفة" },
  snack_2: { en: "Snack", ar: "وجبة خفيفة" },
};

export function MealCard({
  locale,
  mealType,
  items,
  onQuantityChange,
  onRemove,
  onAdd,
  onLogMeal,
  logStatus = "idle",
  onLogItem,
  itemLogStatuses,
  defaultOpen = false,
}: {
  locale: Locale;
  mealType: string;
  items: EditorItem[];
  onQuantityChange: (itemId: string, quantityG: number) => void;
  onRemove: (itemId: string) => void;
  onAdd: (food: FoodResult) => void;
  /** Bridge to the food diary: log this planned meal as eaten today. */
  onLogMeal?: () => void;
  logStatus?: "idle" | "pending" | "done";
  /** Bridge to the food diary: log a single planned food as eaten today. */
  onLogItem?: (item: EditorItem) => void;
  itemLogStatuses?: Record<string, "pending" | "done">;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  const label = MEAL_LABELS[mealType] ?? { en: mealType, ar: mealType };
  const totalKcal = items.reduce((sum, i) => sum + (i.caloriesPer100g * i.quantityG) / 100, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4"
      >
        <span className="font-bold">{pick(locale, label.en, label.ar)}</span>
        <span className="flex items-center gap-3 text-sm text-accent">
          {Math.round(totalKcal)} kcal
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-hairline p-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-semibold">{pick(locale, item.nameEn, item.nameAr)}</span>
              <Input
                type="number"
                value={item.quantityG}
                onChange={(e) => onQuantityChange(item.id, Number(e.target.value))}
                className={cn("h-10 w-20 text-center text-sm")}
              />
              <span className="w-6 text-xs text-muted">g</span>
              {onLogItem && (
                <button
                  type="button"
                  onClick={() => onLogItem(item)}
                  disabled={!!itemLogStatuses?.[item.id]}
                  aria-label={t(locale, "plan.log_item")}
                  title={t(locale, "plan.log_item")}
                  className={cn(
                    "text-muted transition-colors hover:text-accent disabled:pointer-events-none",
                    itemLogStatuses?.[item.id] === "done" && "text-accent",
                  )}
                >
                  {itemLogStatuses?.[item.id] === "done" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <NotebookPen className="h-4 w-4" />
                  )}
                </button>
              )}
              <button type="button" onClick={() => onRemove(item.id)} aria-label="Remove" className="text-muted hover:text-ink">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {onLogMeal && items.length > 0 && (
            <button
              type="button"
              onClick={onLogMeal}
              disabled={logStatus !== "idle"}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold transition-colors",
                logStatus === "done"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-hairline text-accent hover:bg-white/5 disabled:opacity-60",
              )}
            >
              {logStatus === "done" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t(locale, "plan.meal_logged")}
                </>
              ) : (
                <>
                  <NotebookPen className="h-4 w-4" />
                  {t(locale, "plan.log_meal")}
                </>
              )}
            </button>
          )}

          {adding ? (
            <FoodSearch
              locale={locale}
              selected={[]}
              onChange={(foods) => {
                const last = foods[foods.length - 1];
                if (last) {
                  onAdd(last);
                  setAdding(false);
                }
              }}
              placeholder={locale === "tn" ? "لوّج على ماكلة…" : "Search foods…"}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline py-2 text-sm font-semibold text-accent hover:bg-white/5"
            >
              <Plus className="h-4 w-4" />
              {locale === "tn" ? "زيد ماكلة" : "Add food"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
