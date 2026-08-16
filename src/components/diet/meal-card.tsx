"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Repeat2, Trash2 } from "lucide-react";
import { pick, t, type Locale } from "@/lib/i18n";
import { IngredientPicker, type IngredientOption } from "@/components/diet/ingredient-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { swapQuantityG } from "@/lib/algorithms/meal-swap";
import { formatServing, type ServingUnit } from "@/lib/servings";

export type EditorItem = ServingUnit & {
  id: string;
  /** Encoded food ref — a catalog slug, or `uf:<uuid>` for the user's own. */
  foodRef: string;
  nameEn: string | null;
  nameAr: string;
  /** Catalog slot of the current food — swap offers alternatives from it. */
  slot: string;
  quantityG: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl: string | null;
};

export const MEAL_LABELS: Record<string, { en: string; ar: string }> = {
  meal_1: { en: "Meal 1", ar: "الوجبة 1" },
  snack: { en: "Snack", ar: "وجبة خفيفة" },
  meal_2: { en: "Meal 2", ar: "الوجبة 2" },
  meal_3: { en: "Meal 3", ar: "الوجبة 3" },
  pre_workout: { en: "Pre-workout", ar: "قبل التمرين" },
  post_workout: { en: "Post-workout", ar: "بعد التمرين" },
  last_meal: { en: "Last meal", ar: "آخر وجبة" },
  // legacy diary slot keys
  breakfast: { en: "Breakfast", ar: "الفطور" },
  lunch: { en: "Lunch", ar: "الغدا" },
  dinner: { en: "Dinner", ar: "العشا" },
  snack_1: { en: "Snack", ar: "وجبة خفيفة" },
  snack_2: { en: "Snack", ar: "وجبة خفيفة" },
};

/**
 * One meal of the plan template. Pure reference + editing: adjust grams, remove
 * or add a food. Logging lives entirely in the Today view (including its "from
 * my plan" tab), so this card carries no diary affordances.
 */
export function MealCard({
  locale,
  mealType,
  items,
  ingredients,
  onQuantityChange,
  onRemove,
  onAdd,
  onSwap,
  onCreateOwn,
  defaultOpen = false,
}: {
  locale: Locale;
  mealType: string;
  items: EditorItem[];
  ingredients: IngredientOption[];
  onQuantityChange: (itemId: string, quantityG: number) => void;
  onRemove: (itemId: string) => void;
  onAdd: (ingredient: IngredientOption) => void;
  /** Exchange a food for a same-slot alternative at an equivalent portion. */
  onSwap: (item: EditorItem, replacement: IngredientOption) => void;
  /** Opens the "add a food" form; the created food is added to this meal. */
  onCreateOwn?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
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
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-hosted content URL
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg border border-hairline object-cover"
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {pick(locale, item.nameEn, item.nameAr)}
                  </span>
                  {/* The portion in the language of a kitchen, not a scale. The
                      grams beside it stay the authoritative number. */}
                  {formatServing(locale, item.quantityG, item) && (
                    <span className="text-xs text-muted">
                      {formatServing(locale, item.quantityG, item)}
                    </span>
                  )}
                </span>
                <Input
                  type="number"
                  value={item.quantityG}
                  onChange={(e) => onQuantityChange(item.id, Number(e.target.value))}
                  className={cn("h-10 w-20 text-center text-sm")}
                />
                <span className="w-6 text-xs text-muted">g</span>
                <button
                  type="button"
                  onClick={() => setSwappingId((id) => (id === item.id ? null : item.id))}
                  aria-label={t(locale, "plan.swap_food")}
                  title={t(locale, "plan.swap_food")}
                  aria-expanded={swappingId === item.id}
                  className={cn(
                    "text-muted transition-colors hover:text-accent",
                    swappingId === item.id && "text-accent",
                  )}
                >
                  <Repeat2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onRemove(item.id)} aria-label="Remove" className="text-muted hover:text-ink">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {swappingId === item.id && (
                <SwapOptions
                  locale={locale}
                  item={item}
                  mealType={mealType}
                  ingredients={ingredients}
                  onPick={(replacement) => {
                    onSwap(item, replacement);
                    setSwappingId(null);
                  }}
                />
              )}
            </div>
          ))}

          {adding ? (
            <IngredientPicker
              locale={locale}
              ingredients={ingredients}
              onPick={(ing) => {
                onAdd(ing);
                setAdding(false);
              }}
              onCreateOwn={
                onCreateOwn
                  ? () => {
                      setAdding(false);
                      onCreateOwn();
                    }
                  : undefined
              }
              placeholder={t(locale, "cd.search_foods")}
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

/**
 * Same-slot alternatives for one planned food, each shown at the portion that
 * keeps the meal's nutrition (computed with the same function the server uses,
 * so the preview matches what actually gets saved).
 *
 * Meal 1 only offers breakfast foods. The generator already refuses to put
 * chicken breast there; offering it in the swap list would just move the same
 * mistake one tap away.
 */
function SwapOptions({
  locale,
  item,
  mealType,
  ingredients,
  onPick,
}: {
  locale: Locale;
  item: EditorItem;
  mealType: string;
  ingredients: IngredientOption[];
  onPick: (replacement: IngredientOption) => void;
}) {
  const alternatives = ingredients.filter(
    (i) =>
      i.slot === item.slot &&
      i.id !== item.foodRef &&
      (mealType !== "meal_1" || i.breakfastOk),
  );

  if (alternatives.length === 0) {
    return (
      <p className="rounded-xl border border-hairline bg-bg/40 px-3 py-2 text-xs text-muted">
        {t(locale, "plan.no_alternatives")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-bg/40 p-2">
      <span className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {t(locale, "plan.swap_for")}
      </span>
      <div className="flex max-h-56 flex-col divide-y divide-hairline overflow-y-auto">
        {alternatives.map((alt) => {
          const grams = swapQuantityG(item, item.quantityG, alt);
          const serving = formatServing(locale, grams, alt);
          return (
            <button
              key={alt.id}
              type="button"
              onClick={() => onPick(alt)}
              className="flex items-center gap-3 px-1 py-2 text-start hover:bg-white/5"
            >
              <span className="flex-1 truncate text-sm font-semibold">{pick(locale, alt.nameEn, alt.nameAr)}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {serving ? `${serving} · ${grams}g` : `${grams}g`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
