"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { pick, t, type Locale } from "@/lib/i18n";
import type { ServingUnit } from "@/lib/servings";

export type IngredientOption = ServingUnit & {
  /** An encoded food ref — a catalog slug, or `uf:<uuid>` for the user's own. */
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
  /** One of the user's own foods rather than the shared catalog. */
  isOwn?: boolean;
};

/**
 * Add/swap picker over the ingredient catalog plus the user's own foods.
 *
 * Both lists are small — ~40 curated ingredients and however few foods one
 * person has added — so everything is passed in and filtered client-side; there
 * is no search endpoint.
 *
 * The user's own foods sort first when nothing is typed. Somebody who went to
 * the trouble of adding their mother's couscous is looking for it, and burying
 * it under forty catalog rows is how they end up adding it a second time.
 */
export function IngredientPicker({
  locale,
  ingredients,
  onPick,
  onCreateOwn,
  placeholder,
}: {
  locale: Locale;
  ingredients: IngredientOption[];
  onPick: (ingredient: IngredientOption) => void;
  /** Opens the "add a food" form. Omitted where creating one makes no sense. */
  onCreateOwn?: () => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = [...ingredients].sort(
      (a, b) => Number(b.isOwn ?? false) - Number(a.isOwn ?? false),
    );
    if (!q) return ranked.slice(0, 12);
    return ranked
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
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{pick(locale, ing.nameEn, ing.nameAr)}</span>
                {ing.isOwn && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                    {t(locale, "uf.mine")}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                {Math.round(ing.caloriesPer100g)} kcal/100g
                <Plus className="h-4 w-4 shrink-0 text-accent" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* The way out of a curated catalog. Placed under the results rather than
          above them so it reads as the fallback it is — most searches end at a
          catalog row, and this is for the ones that don't. */}
      {onCreateOwn && (
        <button
          type="button"
          onClick={onCreateOwn}
          className="self-start text-xs font-bold text-accent underline decoration-dotted underline-offset-4"
        >
          {t(locale, "uf.missing_cta")}
        </button>
      )}
    </div>
  );
}
