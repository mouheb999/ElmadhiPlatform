"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { pick, type Locale } from "@/lib/i18n";
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
  defaultOpen = false,
}: {
  locale: Locale;
  mealType: string;
  items: EditorItem[];
  onQuantityChange: (itemId: string, quantityG: number) => void;
  onRemove: (itemId: string) => void;
  onAdd: (food: FoodResult) => void;
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
              <button type="button" onClick={() => onRemove(item.id)} aria-label="Remove" className="text-muted hover:text-ink">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

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
