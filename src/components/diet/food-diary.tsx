"use client";

import { useMemo, useState, useSyncExternalStore, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Star, Trash2, X } from "lucide-react";
import { MacroRing } from "@/components/diet/macro-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { pick, t, type Locale, type StringKey } from "@/lib/i18n";
import { nutritionFeedback } from "@/lib/algorithms/nutrition-feedback";
import {
  logFood,
  logPlanMeal,
  logQuick,
  copyPreviousDay,
  removeMealLog,
  toggleFavoriteFood,
  type MealSlot,
} from "@/app/actions/meal-logs";

export type DiaryTargets = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type DiaryEntry = {
  id: string;
  slot: string;
  nameEn: string | null;
  nameAr: string | null;
  quantityG: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  imageUrl: string | null;
};

export type DiaryFood = {
  id: string;
  nameEn: string | null;
  nameAr: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl: string | null;
};

/** Small food photo from the admin CMS; renders nothing when absent. */
function FoodThumb({ src, size = "h-10 w-10" }: { src: string | null; size?: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-hosted content URL
    <img src={src} alt="" className={`${size} shrink-0 rounded-lg border border-hairline object-cover`} />
  );
}

export type DiaryPlanMeal = {
  id: string;
  mealType: string; // plan meal_type: breakfast/lunch/dinner/snack_1/snack_2
  items: { food: DiaryFood; quantityG: number }[];
};

const SLOTS: { key: MealSlot; en: string; ar: string }[] = [
  { key: "breakfast", en: "Breakfast", ar: "الفطور" },
  { key: "lunch", en: "Lunch", ar: "الغدا" },
  { key: "dinner", en: "Dinner", ar: "العشا" },
  { key: "snack", en: "Snack", ar: "وجبة خفيفة" },
];

const PLAN_MEAL_LABELS: Record<string, { en: string; ar: string }> = {
  breakfast: { en: "Breakfast", ar: "الفطور" },
  lunch: { en: "Lunch", ar: "الغدا" },
  dinner: { en: "Dinner", ar: "العشا" },
  snack_1: { en: "Snack", ar: "وجبة خفيفة" },
  snack_2: { en: "Snack 2", ar: "وجبة خفيفة ٢" },
};

/** Same slot mapping as the server action: snack_1/snack_2 → snack. */
function planTypeToSlot(mealType: string): MealSlot {
  if (mealType === "breakfast" || mealType === "lunch" || mealType === "dinner") return mealType;
  return "snack";
}

function planMealKcal(meal: DiaryPlanMeal): number {
  return meal.items.reduce((s, i) => s + (i.food.caloriesPer100g * i.quantityG) / 100, 0);
}

type SheetTab = "plan" | "search" | "recents" | "favorites" | "quick";

/** SSR-safe "mounted" flag (coach messages depend on the local clock). */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function FoodDiary({
  locale,
  targets,
  entries,
  recents,
  favorites,
  planMeals,
  hasPreviousDay,
  isToday,
  dateLabel,
  prevDate,
  nextDate,
}: {
  locale: Locale;
  targets: DiaryTargets | null;
  entries: DiaryEntry[];
  recents: DiaryFood[];
  favorites: DiaryFood[];
  planMeals: DiaryPlanMeal[];
  hasPreviousDay: boolean;
  isToday: boolean;
  dateLabel: string;
  prevDate: string;
  nextDate: string | null;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const [sheetSlot, setSheetSlot] = useState<MealSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const consumed = useMemo(
    () => ({
      calories: entries.reduce((s, e) => s + e.calories, 0),
      proteinG: entries.reduce((s, e) => s + e.proteinG, 0),
      carbsG: entries.reduce((s, e) => s + e.carbsG, 0),
      fatG: entries.reduce((s, e) => s + e.fatG, 0),
    }),
    [entries],
  );

  const coachKeys =
    mounted && targets && isToday
      ? nutritionFeedback(consumed, targets, new Date().getHours())
      : [];

  const remainingKcal = targets ? Math.round(targets.calories - consumed.calories) : 0;

  function copyDay() {
    setError(null);
    startTransition(async () => {
      const result = await copyPreviousDay();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeEntry(id: string) {
    startTransition(async () => {
      const result = await removeMealLog(id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "diary.title")}</h1>
        <p className="text-muted">{t(locale, "diary.subtitle")}</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-2 py-1.5">
        <Link
          href={`/diet/log?date=${prevDate}`}
          aria-label="Previous day"
          className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink"
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
        <span className="text-sm font-bold">{isToday ? t(locale, "diary.today_target") : dateLabel}</span>
        {nextDate ? (
          <Link
            href={`/diet/log?date=${nextDate}`}
            aria-label="Next day"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink"
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
        ) : (
          <span className="h-9 w-9" />
        )}
      </div>

      {targets ? (
        <>
          {/* MyFitnessPal-style equation: Goal − Food = Remaining */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 rounded-2xl border border-hairline bg-surface p-4 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums">{Math.round(targets.calories)}</div>
              <div className="text-[11px] text-muted">{t(locale, "diary.goal")}</div>
            </div>
            <span className="text-muted">−</span>
            <div>
              <div className="text-lg font-extrabold tabular-nums">{Math.round(consumed.calories)}</div>
              <div className="text-[11px] text-muted">{t(locale, "diary.food_label")}</div>
            </div>
            <span className="text-muted">=</span>
            <div>
              <div className={cn("text-lg font-extrabold tabular-nums", remainingKcal < 0 && "text-red-400")}>
                {remainingKcal}
              </div>
              <div className="text-[11px] text-muted">{t(locale, "diary.remaining")}</div>
            </div>
          </div>

          <MacroRing
            variant="neutral"
            calories={Math.round(consumed.calories)}
            caloriesTarget={targets.calories}
            proteinG={consumed.proteinG}
            proteinTargetG={targets.proteinG}
            carbsG={consumed.carbsG}
            carbsTargetG={targets.carbsG}
            fatG={consumed.fatG}
            fatTargetG={targets.fatG}
            dailyTargetLabel={t(locale, "diary.today_target")}
          />
        </>
      ) : (
        <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          {t(locale, "diary.no_target")}
        </p>
      )}

      {coachKeys.map((key) => (
        <p
          key={key}
          className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold"
        >
          {t(locale, key as StringKey)}
        </p>
      ))}

      {isToday && entries.length === 0 && hasPreviousDay && (
        <Button variant="secondary" size="sm" onClick={copyDay} disabled={isPending}>
          <Copy className="h-4 w-4" />
          {t(locale, "diary.copy_yesterday")}
        </Button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {SLOTS.map((slot) => {
        const slotEntries = entries.filter((e) => e.slot === slot.key);
        const slotKcal = slotEntries.reduce((s, e) => s + e.calories, 0);
        return (
          <div key={slot.key} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold">{pick(locale, slot.en, slot.ar)}</div>
              <span className="text-xs tabular-nums text-muted">{Math.round(slotKcal)} kcal</span>
            </div>

            {slotEntries.length === 0 ? (
              <p className="text-sm text-muted">{t(locale, "diary.empty_slot")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {slotEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <FoodThumb src={entry.imageUrl} size="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {pick(locale, entry.nameEn, entry.nameAr) || "—"}
                      </div>
                      <div className="text-xs tabular-nums text-muted">
                        {entry.quantityG ? `${entry.quantityG}g · ` : ""}
                        {Math.round(entry.calories)} kcal · P {Math.round(entry.proteinG)}g
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      aria-label="Remove entry"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline text-muted hover:text-ink"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isToday && (
              <button
                type="button"
                onClick={() => setSheetSlot(slot.key)}
                className="flex items-center gap-1.5 self-start text-sm font-bold text-accent hover:underline"
              >
                <Plus className="h-4 w-4" />
                {t(locale, "diary.add_food")}
              </button>
            )}
          </div>
        );
      })}

      {targets && (
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
            <span className="text-start" />
            <span>{t(locale, "diary.totals")}</span>
            <span>{t(locale, "diary.goal")}</span>
            <span>{t(locale, "diary.remaining")}</span>
          </div>
          {(
            [
              { label: "kcal", value: consumed.calories, goal: targets.calories },
              { label: t(locale, "diary.quick_protein"), value: consumed.proteinG, goal: targets.proteinG },
              { label: t(locale, "diary.quick_carbs"), value: consumed.carbsG, goal: targets.carbsG },
              { label: t(locale, "diary.quick_fat"), value: consumed.fatG, goal: targets.fatG },
            ] as const
          ).map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-4 gap-2 border-t border-hairline py-2 text-center text-sm tabular-nums first:border-t-0"
            >
              <span className="text-start text-xs font-bold text-muted">{row.label}</span>
              <span className="font-semibold">{Math.round(row.value)}</span>
              <span className="text-muted">{Math.round(row.goal)}</span>
              <span className={cn("font-semibold", row.goal - row.value < 0 && "text-red-400")}>
                {Math.round(row.goal - row.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {sheetSlot && (
        <AddFoodSheet
          locale={locale}
          slot={sheetSlot}
          recents={recents}
          favorites={favorites}
          planMeals={planMeals.filter(
            (meal) => planTypeToSlot(meal.mealType) === sheetSlot && meal.items.length > 0,
          )}
          onClose={() => setSheetSlot(null)}
          onLogged={() => {
            setSheetSlot(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type ApiFood = {
  id: string;
  name_ar: string;
  name_en: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  image_url: string | null;
};

function apiToDiaryFood(f: ApiFood): DiaryFood {
  return {
    id: f.id,
    nameEn: f.name_en,
    nameAr: f.name_ar,
    caloriesPer100g: f.calories_per_100g,
    proteinPer100g: f.protein_per_100g,
    carbsPer100g: f.carbs_per_100g,
    fatPer100g: f.fat_per_100g,
    imageUrl: f.image_url,
  };
}

function AddFoodSheet({
  locale,
  slot,
  recents,
  favorites,
  planMeals,
  onClose,
  onLogged,
}: {
  locale: Locale;
  slot: MealSlot;
  recents: DiaryFood[];
  favorites: DiaryFood[];
  planMeals: DiaryPlanMeal[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [tab, setTab] = useState<SheetTab>(
    planMeals.length > 0 ? "plan" : recents.length > 0 ? "recents" : "search",
  );
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<DiaryFood[]>([]);
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set(favorites.map((f) => f.id)));
  const [selected, setSelected] = useState<DiaryFood | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [quick, setQuick] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchTooShort = debounced.trim().length < 2;
  const loading = tab === "search" && !searchTooShort && resultsFor !== debounced;

  useEffect(() => {
    if (searchTooShort) return;
    let cancelled = false;
    fetch(`/api/foods/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((data: { foods: ApiFood[] }) => {
        if (cancelled) return;
        setResults((data.foods ?? []).map(apiToDiaryFood));
        setResultsFor(debounced);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debounced, searchTooShort]);

  function toggleFav(food: DiaryFood) {
    const isFav = favIds.has(food.id);
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(food.id);
      else next.add(food.id);
      return next;
    });
    startTransition(async () => {
      await toggleFavoriteFood(food.id, !isFav);
    });
  }

  function submitFood() {
    if (!selected) return;
    const grams = parseFloat(quantity);
    setError(null);
    startTransition(async () => {
      const result = await logFood({
        slot,
        foodId: selected.id,
        quantityG: grams,
        entryMethod:
          tab === "plan"
            ? "plan"
            : tab === "favorites"
              ? "favorite"
              : tab === "recents"
                ? "recent"
                : "search",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLogged();
    });
  }

  function submitPlanMeal(mealId: string) {
    setError(null);
    startTransition(async () => {
      const result = await logPlanMeal(mealId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLogged();
    });
  }

  function submitQuick() {
    setError(null);
    startTransition(async () => {
      const result = await logQuick({
        slot,
        name: quick.name,
        calories: parseFloat(quick.calories),
        proteinG: quick.protein.trim() ? parseFloat(quick.protein) : null,
        carbsG: quick.carbs.trim() ? parseFloat(quick.carbs) : null,
        fatG: quick.fat.trim() ? parseFloat(quick.fat) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLogged();
    });
  }

  const grams = parseFloat(quantity);
  const factor = Number.isFinite(grams) && grams > 0 ? grams / 100 : 0;

  const listForTab = tab === "recents" ? recents : tab === "favorites" ? favorites : searchTooShort ? [] : results;

  const TABS: { key: SheetTab; label: StringKey }[] = [
    ...(planMeals.length > 0 ? ([{ key: "plan", label: "diary.tab_plan" }] as const) : []),
    { key: "recents", label: "diary.tab_recents" },
    { key: "favorites", label: "diary.tab_favorites" },
    { key: "search", label: "diary.tab_search" },
    { key: "quick", label: "diary.tab_quick" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl border border-hairline bg-bg p-5 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t(locale, "diary.add_food")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, "diary.close")}
            className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4">
              <FoodThumb src={selected.imageUrl} size="h-12 w-12" />
              <div>
                <div className="font-bold">{pick(locale, selected.nameEn, selected.nameAr)}</div>
                <div className="text-xs text-muted">
                  {Math.round(selected.caloriesPer100g)} kcal · P {Math.round(selected.proteinPer100g)}g / 100g
                </div>
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">{t(locale, "diary.quantity")}</span>
              <Input
                type="number"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12 text-center"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              {[50, 100, 150, 200].map((grams) => (
                <button
                  key={grams}
                  type="button"
                  onClick={() => setQuantity(String(grams))}
                  className={cn(
                    "flex-1 rounded-full border py-1.5 text-xs font-bold transition-colors",
                    quantity === String(grams)
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-hairline text-muted hover:text-ink",
                  )}
                >
                  {grams}g
                </button>
              ))}
            </div>
            {factor > 0 && (
              <p className="text-center text-sm tabular-nums text-muted">
                {Math.round(selected.caloriesPer100g * factor)} kcal · P{" "}
                {Math.round(selected.proteinPer100g * factor)}g · C {Math.round(selected.carbsPer100g * factor)}g · F{" "}
                {Math.round(selected.fatPer100g * factor)}g
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSelected(null)}>
                {t(locale, "diary.back")}
              </Button>
              <Button size="sm" className="flex-1" onClick={submitFood} disabled={isPending || factor <= 0}>
                {t(locale, "diary.log_cta")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TABS.map((tabDef) => (
                <button
                  key={tabDef.key}
                  type="button"
                  onClick={() => setTab(tabDef.key)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                    tab === tabDef.key ? "bg-accent text-bg" : "border border-hairline text-muted hover:text-ink",
                  )}
                >
                  {t(locale, tabDef.label)}
                </button>
              ))}
            </div>

            {tab === "plan" ? (
              <div className="flex flex-col gap-3">
                {planMeals.map((meal) => {
                  const label = PLAN_MEAL_LABELS[meal.mealType] ?? { en: meal.mealType, ar: meal.mealType };
                  return (
                    <div key={meal.id} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{pick(locale, label.en, label.ar)}</span>
                        <span className="text-xs tabular-nums text-muted">{Math.round(planMealKcal(meal))} kcal</span>
                      </div>
                      <div className="flex flex-col divide-y divide-hairline">
                        {meal.items.map((item) => (
                          <button
                            key={item.food.id}
                            type="button"
                            onClick={() => {
                              setSelected(item.food);
                              setQuantity(String(item.quantityG));
                            }}
                            className="flex items-center gap-3 py-2 text-start"
                          >
                            <FoodThumb src={item.food.imageUrl} size="h-9 w-9" />
                            <span className="flex-1 text-sm font-semibold">
                              {pick(locale, item.food.nameEn, item.food.nameAr)}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted">
                              {item.quantityG}g · {Math.round((item.food.caloriesPer100g * item.quantityG) / 100)} kcal
                            </span>
                          </button>
                        ))}
                      </div>
                      <Button size="sm" onClick={() => submitPlanMeal(meal.id)} disabled={isPending}>
                        {t(locale, "diary.log_meal")}
                      </Button>
                    </div>
                  );
                })}
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            ) : tab === "quick" ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted">{t(locale, "diary.quick_name")}</span>
                  <Input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "diary.quick_calories")}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={quick.calories}
                      onChange={(e) => setQuick({ ...quick, calories: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "diary.quick_protein")}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={quick.protein}
                      onChange={(e) => setQuick({ ...quick, protein: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "diary.quick_carbs")}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={quick.carbs}
                      onChange={(e) => setQuick({ ...quick, carbs: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "diary.quick_fat")}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={quick.fat}
                      onChange={(e) => setQuick({ ...quick, fat: e.target.value })}
                    />
                  </label>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button size="sm" onClick={submitQuick} disabled={isPending || !quick.calories.trim()}>
                  {t(locale, "diary.log_cta")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tab === "search" && (
                  <div className="relative">
                    <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t(locale, "diary.search_placeholder")}
                      className="ps-11"
                      autoFocus
                    />
                  </div>
                )}

                {loading && <p className="text-sm text-muted">…</p>}

                {listForTab.length === 0 && !loading ? (
                  <p className="py-4 text-center text-sm text-muted">
                    {tab === "recents"
                      ? t(locale, "diary.no_recents")
                      : tab === "favorites"
                        ? t(locale, "diary.no_favorites")
                        : null}
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
                    {listForTab.map((food) => (
                      <div key={food.id} className="flex items-center gap-2 bg-surface p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(food);
                            setQuantity("100");
                          }}
                          className="flex flex-1 items-center gap-3 text-start"
                        >
                          <FoodThumb src={food.imageUrl} size="h-9 w-9" />
                          <span className="flex-1 font-semibold">{pick(locale, food.nameEn, food.nameAr)}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            {Math.round(food.caloriesPer100g)} kcal/100g
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFav(food)}
                          aria-label="Favorite"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:text-ink"
                        >
                          <Star
                            className={cn("h-4 w-4", favIds.has(food.id) && "fill-accent text-accent")}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
