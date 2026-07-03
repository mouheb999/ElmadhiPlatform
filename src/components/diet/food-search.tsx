"use client";

import { useEffect, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pick, type Locale } from "@/lib/i18n";

export type FoodResult = {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  image_url: string | null;
};

/**
 * Debounced food search + selection list. Used both for the diet wizard's
 * "anything you don't like?" step and the plan editor's swap/add-food flow.
 */
export function FoodSearch({
  locale,
  selected,
  onChange,
  placeholder,
}: {
  locale: Locale;
  selected: FoodResult[];
  onChange: (foods: FoodResult[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<FoodResult[]>([]);
  // Tracks which query the current `results` were fetched for, so "loading"
  // is derived at render time instead of toggled synchronously in the effect.
  const [resultsFor, setResultsFor] = useState<string | null>(null);

  const searchTooShort = debounced.trim().length < 2;
  const loading = !searchTooShort && resultsFor !== debounced;

  useEffect(() => {
    if (searchTooShort) return;
    let cancelled = false;
    fetch(`/api/foods/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((data: { foods: FoodResult[] }) => {
        if (cancelled) return;
        setResults(data.foods ?? []);
        setResultsFor(debounced);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, searchTooShort]);

  const visibleResults = searchTooShort ? [] : results;

  function add(food: FoodResult) {
    if (selected.some((f) => f.id === food.id)) return;
    onChange([...selected, food]);
    setQuery("");
    setResults([]);
  }

  function remove(id: string) {
    onChange(selected.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="ps-11"
        />
      </div>

      {loading && <p className="text-sm text-muted">…</p>}

      {visibleResults.length > 0 && (
        <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
          {visibleResults.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => add(food)}
              className="flex items-center justify-between gap-3 bg-surface p-3 text-start hover:bg-white/5"
            >
              <span className="font-semibold">{pick(locale, food.name_en, food.name_ar)}</span>
              <Plus className="h-4 w-4 shrink-0 text-accent" />
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((food) => (
            <span
              key={food.id}
              className="flex items-center gap-1.5 rounded-full bg-white/5 py-1.5 ps-3 pe-2 text-sm"
            >
              {pick(locale, food.name_en, food.name_ar)}
              <button type="button" onClick={() => remove(food.id)} aria-label="Remove">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
