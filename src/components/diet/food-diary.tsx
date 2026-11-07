"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Lock,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { LockedDialog } from "@/components/shared/locked-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatServing, type ServingUnit } from "@/lib/servings";
import { MEAL_SLOT_LABELS } from "@/lib/meal-slots";

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

export type DiaryFood = ServingUnit & {
  /** Encoded food ref — a catalog slug, or `uf:<uuid>` for the user's own. */
  id: string;
  nameEn: string | null;
  nameAr: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl: string | null;
  /** One of the user's own foods. Cannot be favourited — see `toggleFav`. */
  isOwn?: boolean;
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
  mealType: string; // template meal_key: meal_1/snack/meal_2/meal_3/pre_workout/post_workout/last_meal
  items: { food: DiaryFood; quantityG: number }[];
};

// Labels shared with the Today screen; see lib/meal-slots.
const PLAN_MEAL_LABELS = MEAL_SLOT_LABELS;

function slotLabel(locale: Locale, key: string): string {
  const label = PLAN_MEAL_LABELS[key];
  return label ? pick(locale, label.en, label.ar) : key;
}

/** The label map's keys are exactly the slots the DB constraint permits. */
function isMealSlot(key: string): key is MealSlot {
  return key in PLAN_MEAL_LABELS;
}

/**
 * The day's rows: every meal in the user's plan, in plan order, plus "Other"
 * for anything eaten off-plan. Any legacy slot that still holds entries on the
 * viewed day is appended so old days stay readable.
 */
function diarySlots(planMeals: DiaryPlanMeal[], entries: DiaryEntry[]): MealSlot[] {
  const slots = planMeals.map((m) => m.mealType).filter(isMealSlot);
  for (const entry of entries) {
    if (isMealSlot(entry.slot) && !slots.includes(entry.slot)) slots.push(entry.slot);
  }
  if (!slots.includes("other")) slots.push("other");
  return slots;
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
  ingredients,
  planMeals,
  hasPreviousDay,
  isToday,
  dateLabel,
  prevDate,
  nextDate,
  locked = false,
  appShell = false,
}: {
  locale: Locale;
  targets: DiaryTargets | null;
  entries: DiaryEntry[];
  recents: DiaryFood[];
  favorites: DiaryFood[];
  ingredients: DiaryFood[];
  planMeals: DiaryPlanMeal[];
  hasPreviousDay: boolean;
  isToday: boolean;
  dateLabel: string;
  prevDate: string;
  nextDate: string | null;
  /** Free account: the diary is readable, but logging into it is not. */
  locked?: boolean;
  /**
   * Inside the Android app: the wall above says "members only" and points at
   * /support instead of naming a price. Threaded from the server rather than
   * sniffed from `navigator.userAgent` here, which would differ between the
   * server render and the client's and tear the hydration.
   */
  appShell?: boolean;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const [sheetSlot, setSheetSlot] = useState<MealSlot | null>(null);
  const [showLock, setShowLock] = useState(false);
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

  const slots = useMemo(() => diarySlots(planMeals, entries), [planMeals, entries]);

  const coachKeys =
    mounted && targets && isToday
      ? nutritionFeedback(consumed, targets, new Date().getHours())
      : [];

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
      {/* Day switcher: the day in the middle, a grey disc either side. The
          page header above already says this is the food diary. */}
      <div className="card-surface flex h-14 items-center justify-between px-2">
        <Link
          href={`/diet?view=today&date=${prevDate}`}
          aria-label="Previous day"
          className="press grid h-10 w-10 place-items-center rounded-full bg-surface2 text-ink"
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
        <span className="text-[17px] font-semibold">{isToday ? t(locale, "diary.today_target") : dateLabel}</span>
        {nextDate ? (
          <Link
            href={`/diet?view=today&date=${nextDate}`}
            aria-label="Next day"
            className="press grid h-10 w-10 place-items-center rounded-full bg-surface2 text-ink"
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      {targets ? (
        <DiaryHero locale={locale} targets={targets} consumed={consumed} />
      ) : (
        <p className="card-surface px-5 py-4 text-[15px] text-muted">
          {t(locale, "diary.no_target")}
        </p>
      )}

      {coachKeys.map((key) => (
        <p
          key={key}
          className="rounded-2xl bg-train/[0.12] px-4 py-3.5 text-[15px] font-semibold"
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

      {error && <p className="text-sm text-danger">{error}</p>}

      {slots.map((slotKey) => {
        const slotEntries = entries.filter((e) => e.slot === slotKey);
        const slotKcal = slotEntries.reduce((s, e) => s + e.calories, 0);
        // What the plan says to eat at this occasion — shown as the target
        // beside what was actually logged, so the two are directly comparable.
        const planned = planMeals.find((m) => m.mealType === slotKey);
        const plannedKcal = planned ? planMealKcal(planned) : 0;
        // An empty "Other" bucket is noise; it only appears once used.
        if (slotKey === "other" && slotEntries.length === 0) return null;
        return (
          <section key={slotKey} className="card-surface flex flex-col gap-2 p-5">
            {/* Title row as Today draws it: the meal at 20px, what was eaten
                against what the plan allows at the end. Green once something is
                logged; red while the meal is still empty, so the meals left to
                log stand out down the page. */}
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">
                {slotLabel(locale, slotKey)}
              </h2>
              <span
                className={cn(
                  "flex shrink-0 items-baseline gap-1",
                  slotEntries.length > 0 ? "text-train" : "text-danger",
                )}
              >
                <span className="font-num text-[17px] font-bold">
                  {Math.round(slotKcal)}
                  {plannedKcal > 0 && <span className="text-muted">/{Math.round(plannedKcal)}</span>}
                </span>
                <span className="text-[11px] font-bold uppercase">{t(locale, "home.kcal")}</span>
              </span>
            </div>

            {slotEntries.length === 0 ? (
              <p className="text-[15px] text-muted">{t(locale, "diary.empty_slot")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {slotEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <FoodThumb src={entry.imageUrl} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">
                        {pick(locale, entry.nameEn, entry.nameAr) || "—"}
                      </div>
                      <div className="text-[13px] tabular-nums text-muted">
                        {entry.quantityG ? `${entry.quantityG}g · ` : ""}
                        {Math.round(entry.calories)} kcal · P {Math.round(entry.proteinG)}g
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      aria-label="Remove entry"
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-muted hover:text-ink"
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
                // A free account keeps the button and gets told why, rather
                // than losing the screen it was reading to a redirect. The
                // logging actions guard themselves regardless; this is what the
                // user sees, not what enforces it.
                onClick={() => (locked ? setShowLock(true) : setSheetSlot(slotKey))}
                className="press mt-1 flex items-center gap-2.5 self-start text-[15px] font-semibold text-accent"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15">
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" strokeWidth={2.6} />}
                </span>
                {t(locale, "diary.add_food")}
              </button>
            )}
          </section>
        );
      })}

      {showLock && (
        <LockedDialog
          locale={locale}
          feature="meal_log"
          appShell={appShell}
          onClose={() => setShowLock(false)}
        />
      )}

      {sheetSlot && (
        <AddFoodSheet
          locale={locale}
          slot={sheetSlot}
          recents={recents}
          favorites={favorites}
          ingredients={ingredients}
          planMeals={planMeals.filter((meal) => meal.mealType === sheetSlot && meal.items.length > 0)}
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

/**
 * The day's single readout. Replaces what used to be three overlapping views of
 * the same numbers (a Goal−Food=Remaining strip, a calorie ring, and a totals
 * table): one hero answers "what do I have left today", and the exact
 * Totals/Goal/Remaining grid is a tap away for anyone who wants the detail.
 */
function DiaryHero({
  locale,
  targets,
  consumed,
}: {
  locale: Locale;
  targets: DiaryTargets;
  consumed: { calories: number; proteinG: number; carbsG: number; fatG: number };
}) {
  const [showDetails, setShowDetails] = useState(false);

  const over = consumed.calories > targets.calories;
  const caloriePct = targets.calories > 0 ? Math.min((consumed.calories / targets.calories) * 100, 100) : 0;

  // Each macro in its own colour, the same three Today uses.
  const macros = [
    {
      label: t(locale, "diary.macro_protein"),
      detailLabel: t(locale, "diary.quick_protein"),
      value: consumed.proteinG,
      goal: targets.proteinG,
      text: "text-protein",
      bar: "bg-protein",
    },
    {
      label: t(locale, "diary.macro_carbs"),
      detailLabel: t(locale, "diary.quick_carbs"),
      value: consumed.carbsG,
      goal: targets.carbsG,
      text: "text-fuel",
      bar: "bg-fuel",
    },
    {
      label: t(locale, "diary.macro_fat"),
      detailLabel: t(locale, "diary.quick_fat"),
      value: consumed.fatG,
      goal: targets.fatG,
      text: "text-sleep",
      bar: "bg-sleep",
    },
  ];

  return (
    <section aria-label={t(locale, "diary.kcal_eaten")} className="card-surface flex flex-col gap-4 p-5">
      {/* Eaten vs. goal — one plain reading of the day, set the way Today
          sets its figures: the number in green with its unit in small
          capitals beside it. Red only when the day is over target. */}
      <div>
        <div className={cn("flex items-baseline gap-1", over ? "text-danger" : "text-train")}>
          <span className="font-num text-[40px] font-bold leading-none">
            {Math.round(consumed.calories).toLocaleString("en-US")}
          </span>
          <span className="font-num text-[22px] font-bold leading-none opacity-60">
            /{Math.round(targets.calories).toLocaleString("en-US")}
          </span>
          <span className="ms-0.5 text-[15px] font-bold uppercase">{t(locale, "home.kcal")}</span>
        </div>
        <div className="mt-1.5 text-[13px] text-muted">{t(locale, "diary.kcal_eaten")}</div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-train/20">
        <div
          className={cn("h-full rounded-full transition-all duration-500", over ? "bg-danger" : "bg-train")}
          style={{ width: `${caloriePct}%` }}
        />
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        {macros.map((macro) => (
          <div key={macro.label} className="min-w-0">
            <dt className="truncate text-[13px] font-semibold text-ink">{macro.label}</dt>
            <dd className={cn("flex items-baseline gap-0.5", macro.text)}>
              <span className="font-num text-[20px] font-bold leading-tight">{Math.round(macro.value)}</span>
              <span className="font-num text-[13px] font-bold opacity-60">/{Math.round(macro.goal)}</span>
              <span className="text-[11px] font-bold uppercase">{t(locale, "home.g")}</span>
            </dd>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={cn("h-full rounded-full transition-all duration-500", macro.bar)}
                style={{ width: `${macro.goal > 0 ? Math.min((macro.value / macro.goal) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        aria-expanded={showDetails}
        className="press flex items-center justify-center gap-1 text-[13px] font-semibold text-muted hover:text-ink"
      >
        {t(locale, "diary.details")}
        {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {showDetails && (
        <div className="border-t border-hairline pt-3">
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold tracking-normal text-muted">
            <span className="text-start" />
            <span>{t(locale, "diary.totals")}</span>
            <span>{t(locale, "diary.goal")}</span>
            <span>{t(locale, "diary.remaining")}</span>
          </div>
          {[
            { label: "kcal", value: consumed.calories, goal: targets.calories },
            ...macros.map((m) => ({ label: m.detailLabel, value: m.value, goal: m.goal })),
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-4 gap-2 border-t border-hairline py-2 text-center text-sm tabular-nums first:border-t-0"
            >
              <span className="text-start text-xs font-bold text-muted">{row.label}</span>
              <span className="font-semibold">{Math.round(row.value)}</span>
              <span className="text-muted">{Math.round(row.goal)}</span>
              <span className={cn("font-semibold", row.goal - row.value < 0 && "text-danger")}>
                {Math.round(row.goal - row.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function AddFoodSheet({
  locale,
  slot,
  recents,
  favorites,
  ingredients,
  planMeals,
  onClose,
  onLogged,
}: {
  locale: Locale;
  slot: MealSlot;
  recents: DiaryFood[];
  favorites: DiaryFood[];
  ingredients: DiaryFood[];
  planMeals: DiaryPlanMeal[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [tab, setTab] = useState<SheetTab>(
    planMeals.length > 0 ? "plan" : recents.length > 0 ? "recents" : "search",
  );
  const [query, setQuery] = useState("");
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set(favorites.map((f) => f.id)));
  const [selected, setSelected] = useState<DiaryFood | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [quick, setQuick] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The catalog is ~40 items, so search filters it client-side.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients.slice(0, 12);
    return ingredients
      .filter((f) => (f.nameEn ?? "").toLowerCase().includes(q) || f.nameAr.includes(query.trim()))
      .slice(0, 20);
  }, [query, ingredients]);
  const loading = false;

  /**
   * Favourites are keyed on the shared catalog (`food_favorites.ingredient_id`
   * is a NOT NULL foreign key to it), so a user's own food cannot be starred.
   * The button is hidden for those rather than shown and refused — and they
   * already sort to the top of the picker, which is what starring buys.
   */
  function toggleFav(food: DiaryFood) {
    if (food.isOwn) return;
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
        foodRef: selected.id,
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

  const listForTab = tab === "recents" ? recents : tab === "favorites" ? favorites : results;

  // Ordered by how often each path actually gets used: logging straight from
  // the plan is the common case, ad-hoc entry the rare one.
  const TABS: { key: SheetTab; label: StringKey }[] = [
    ...(planMeals.length > 0 ? ([{ key: "plan", label: "diary.tab_plan" }] as const) : []),
    { key: "recents", label: "diary.tab_recents" },
    { key: "search", label: "diary.tab_search" },
    { key: "favorites", label: "diary.tab_favorites" },
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
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
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
            {error && <p className="text-sm text-danger">{error}</p>}
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
                    <div key={meal.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
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
                            <span className="shrink-0 text-end text-xs text-muted">
                              <span className="tabular-nums">
                                {item.quantityG}g · {Math.round((item.food.caloriesPer100g * item.quantityG) / 100)} kcal
                              </span>
                              {formatServing(locale, item.quantityG, item.food) && (
                                <span className="block">
                                  {formatServing(locale, item.quantityG, item.food)}
                                </span>
                              )}
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
                {error && <p className="text-sm text-danger">{error}</p>}
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
                {error && <p className="text-sm text-danger">{error}</p>}
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
                          <span className="flex flex-1 items-center gap-2">
                            <span className="font-semibold">{pick(locale, food.nameEn, food.nameAr)}</span>
                            {food.isOwn && (
                              <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                                {t(locale, "uf.mine")}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            {Math.round(food.caloriesPer100g)} kcal/100g
                          </span>
                        </button>
                        {!food.isOwn && (
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
                        )}
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
