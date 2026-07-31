"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { pick, type Locale } from "@/lib/i18n";
import type { ServingUnit } from "@/lib/servings";

export type IngredientOption = ServingUnit & {
  id: string;
  nameEn: string | null;
  nameAr: string;
  /** Catalog slot (protein/carb/fat/…) — drives same-slot swap alternatives. */
  slot: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl: string | null;
  /** False for foods that must not be offered in Meal 1 (migration 036). */
  breakfastOk: boolean;
};

/**
 * Add/swap picker over the canonical ingredient catalog. The whole catalog is
 * ~40 items, so it's passed in and filtered client-side — no search endpoint.
 */
export function IngredientPicker({
  locale,
  ingredients,
  onPick,
  placeholder,
}: {
  locale: Locale;
  ingredients: IngredientOption[];
  onPick: (ingredient: IngredientOption) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients.slice(0, 12);
    return ingredients
      .filter(
        (i) =>
          (i.nameEn ?? "").toLowerCase().includes(q) || i.nameAr.includes(query.trim()),
      )
      .slice(0, 20);
  }, [query, ingredients]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="ps-11" />
      </div>

      {results.length > 0 && (
        <div className="flex max-h-64 flex-col divide-y divide-hairline overflow-y-auto rounded-2xl border border-hairline">
          {results.map((ing) => (
            <button
              key={ing.id}
              type="button"
              onClick={() => onPick(ing)}
              className="flex items-center justify-between gap-3 bg-surface p-3 text-start hover:bg-white/5"
            >
              <span className="font-semibold">{pick(locale, ing.nameEn, ing.nameAr)}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {Math.round(ing.caloriesPer100g)} kcal/100g
                <Plus className="h-4 w-4 shrink-0 text-accent" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
