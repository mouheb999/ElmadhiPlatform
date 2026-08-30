"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IngredientPicker, type IngredientOption } from "@/components/diet/ingredient-picker";
import { UserFoodForm } from "@/components/diet/user-food-form";
import { MEAL_LABELS } from "@/components/diet/meal-card";
import { MacroRing } from "@/components/diet/macro-ring";
import { createCustomMealPlan, type DietEssentials } from "@/app/actions/custom-diet";
import { calculateMacros } from "@/lib/algorithms/macros";
import { MAX_ITEMS_PER_MEAL, MAX_QUANTITY_G } from "@/lib/program-limits";
import { formatServing } from "@/lib/servings";
import { cn } from "@/lib/utils";
import { dir, pick, t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * The order meals appear in a day. The plan is stored with an explicit
 * order_index, but the *offer* has to be in eating order or picking four meals
 * hands you breakfast, a snack, dinner and lunch in that sequence.
 */
const MEAL_KEYS = [
  "meal_1",
  "snack",
  "meal_2",
  "pre_workout",
  "post_workout",
  "meal_3",
  "last_meal",
] as const;

/** What a plan opens with — three meals is the commonest shape by a distance. */
const DEFAULT_MEAL_KEYS: string[] = ["meal_1", "meal_2", "meal_3"];

type DraftItem = { foodRef: string; quantityG: number };
type DraftMeal = { mealKey: string; items: DraftItem[] };

const GOAL_OPTIONS: { value: DietEssentials["goal"]; label: StringKey }[] = [
  { value: "lose_fat", label: "ce.goal_lose_fat" },
  { value: "build_muscle", label: "ce.goal_build_muscle" },
  { value: "recomp", label: "ce.goal_recomp" },
  { value: "maintain", label: "ce.goal_maintain" },
];

const ACTIVITY_OPTIONS: { value: DietEssentials["activityLevel"]; label: StringKey }[] = [
  { value: "sedentary", label: "ce.act_sedentary" },
  { value: "light", label: "ce.act_light" },
  { value: "moderate", label: "ce.act_moderate" },
  { value: "active", label: "ce.act_active" },
  { value: "very_active", label: "ce.act_very_active" },
];

/**
 * Build a meal plan by hand: answer the nine questions the macro formula needs,
 * see the targets, then fill the meals from the catalog and your own foods.
 *
 * The targets are previewed here with the very same `calculateMacros` the
 * server will run — it is a pure function with no Supabase in it, so both sides
 * can call it. The server's answer is still the one that gets stored; this is
 * so the user is choosing food against a real number rather than in the dark.
 *
 * Everything is local state until Save, for the same reason the split builder
 * is: a half-saved plan is a plan the diary would happily offer to log.
 */
export function PlanBuilder({
  locale,
  foods: initialFoods,
  isRedo,
}: {
  locale: Locale;
  foods: IngredientOption[];
  isRedo: boolean;
}) {
  const router = useRouter();
  const direction = dir(locale);

  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<DietEssentials["gender"]>("male");
  const [age, setAge] = useState("28");
  const [heightCm, setHeightCm] = useState("175");
  const [weightKg, setWeightKg] = useState("75");
  const [targetWeightKg, setTargetWeightKg] = useState("72");
  const [goal, setGoal] = useState<DietEssentials["goal"]>("lose_fat");
  // Left empty on purpose: most people do not know it, and an invented default
  // would silently swap the whole resting-energy formula for a guess.
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [activityLevel, setActivityLevel] = useState<DietEssentials["activityLevel"]>("light");

  const [foods, setFoods] = useState(initialFoods);
  const [meals, setMeals] = useState<DraftMeal[]>(
    DEFAULT_MEAL_KEYS.map((mealKey) => ({ mealKey, items: [] })),
  );
  const [activeMeal, setActiveMeal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const foodByRef = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const essentials: DietEssentials = {
    gender,
    age: Number(age),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    targetWeightKg: Number(targetWeightKg),
    goal,
    activityLevel,
    bodyFatPercent: bodyFatPercent.trim() === "" ? null : Number(bodyFatPercent),
  };

  const numbersValid =
    Number.isFinite(essentials.age) &&
    essentials.age >= 14 &&
    essentials.age <= 90 &&
    Number.isFinite(essentials.heightCm) &&
    essentials.heightCm >= 120 &&
    essentials.heightCm <= 230 &&
    Number.isFinite(essentials.weightKg) &&
    essentials.weightKg >= 30 &&
    essentials.weightKg <= 300 &&
    Number.isFinite(essentials.targetWeightKg) &&
    essentials.targetWeightKg >= 30 &&
    essentials.targetWeightKg <= 300;

  const targets = useMemo(() => {
    if (!numbersValid) return null;
    return calculateMacros({
      gender: essentials.gender,
      birthDate: new Date(`${new Date().getFullYear() - Math.round(essentials.age)}-01-01`),
      heightCm: essentials.heightCm,
      weightKg: essentials.weightKg,
      activityLevel: essentials.activityLevel,
      goal: essentials.goal,
      bodyFatPercent: essentials.bodyFatPercent,
    });
    // Recomputed from the flat values so a changed field is reflected without
    // rebuilding the object identity check by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    numbersValid,
    gender,
    age,
    heightCm,
    weightKg,
    goal,
    activityLevel,
    bodyFatPercent,
  ]);

  const totals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const meal of meals) {
      for (const item of meal.items) {
        const food = foodByRef.get(item.foodRef);
        if (!food) continue;
        const factor = item.quantityG / 100;
        calories += food.caloriesPer100g * factor;
        proteinG += food.proteinPer100g * factor;
        carbsG += food.carbsPer100g * factor;
        fatG += food.fatPer100g * factor;
      }
    }
    return { calories, proteinG, carbsG, fatG };
  }, [meals, foodByRef]);

  function toggleMeal(mealKey: string) {
    setMeals((prev) => {
      const existing = prev.find((m) => m.mealKey === mealKey);
      // Removing a meal that already has food in it silently discards that
      // work, so it is refused; emptying it first is an explicit act.
      if (existing) {
        if (existing.items.length > 0) return prev;
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m.mealKey !== mealKey);
      }
      const next = [...prev, { mealKey, items: [] }];
      // Keep the plan in eating order however it was assembled.
      next.sort(
        (a, b) =>
          MEAL_KEYS.indexOf(a.mealKey as (typeof MEAL_KEYS)[number]) -
          MEAL_KEYS.indexOf(b.mealKey as (typeof MEAL_KEYS)[number]),
      );
      return next;
    });
  }

  function addItem(mealIndex: number, food: IngredientOption) {
    setMeals((prev) =>
      prev.map((meal, i) => {
        if (i !== mealIndex) return meal;
        if (meal.items.length >= MAX_ITEMS_PER_MEAL) return meal;
        if (meal.items.some((item) => item.foodRef === food.id)) return meal;
        return {
          ...meal,
          items: [
            ...meal.items,
            // A typical serving where the catalog knows one, otherwise 100 g —
            // which is the number the user is about to adjust anyway.
            { foodRef: food.id, quantityG: Math.round(food.unitGrams ?? 100) },
          ],
        };
      }),
    );
  }

  function updateQuantity(mealIndex: number, foodRef: string, quantityG: number) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i === mealIndex
          ? {
              ...meal,
              items: meal.items.map((item) =>
                item.foodRef === foodRef ? { ...item, quantityG } : item,
              ),
            }
          : meal,
      ),
    );
  }

  function removeItem(mealIndex: number, foodRef: string) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i === mealIndex
          ? { ...meal, items: meal.items.filter((item) => item.foodRef !== foodRef) }
          : meal,
      ),
    );
  }

  const canSave = meals.length > 0 && meals.every((m) => m.items.length > 0);

  function save() {
    if (!canSave) {
      setError(t(locale, "cd.meal_needs_food"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createCustomMealPlan({
        essentials,
        meals: meals.map((meal) => ({
          mealKey: meal.mealKey,
          items: meal.items.map((item) => {
            // Split back into the two columns the row actually stores. The
            // server re-derives this itself; sending both shapes would let a
            // client disagree with it.
            const isOwn = item.foodRef.startsWith("uf:");
            return {
              ingredientId: isOwn ? undefined : item.foodRef,
              userFoodId: isOwn ? item.foodRef.slice(3) : undefined,
              quantityG: item.quantityG,
            };
          }),
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/diet?view=plan");
      router.refresh();
    });
  }

  function mealLabel(mealKey: string): string {
    const label = MEAL_LABELS[mealKey] ?? { en: mealKey, ar: mealKey };
    return pick(locale, label.en, label.ar);
  }

  return (
    <div dir={direction} className="flex flex-col gap-5">
      <StepBar locale={locale} step={step} labels={["cd.step_numbers", "cd.step_meals"]} />

      {/* ---- 1. the answers the formula reads ---- */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "cd.title")}</h1>

          <ChoiceGroup
            label={t(locale, "ce.gender")}
            options={[
              { value: "male", label: t(locale, "ce.male") },
              { value: "female", label: t(locale, "ce.female") },
            ]}
            value={gender}
            onChange={(v) => setGender(v as DietEssentials["gender"])}
            inline
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField label={t(locale, "ce.age")} value={age} onChange={setAge} />
            <NumberField label={t(locale, "ce.height")} value={heightCm} onChange={setHeightCm} />
            <NumberField label={t(locale, "ce.weight")} value={weightKg} onChange={setWeightKg} />
            <NumberField
              label={t(locale, "ce.target_weight")}
              value={targetWeightKg}
              onChange={setTargetWeightKg}
            />
          </div>

          <ChoiceGroup
            label={t(locale, "ce.goal")}
            options={GOAL_OPTIONS.map((o) => ({ value: o.value, label: t(locale, o.label) }))}
            value={goal}
            onChange={(v) => setGoal(v as DietEssentials["goal"])}
          />
          <ChoiceGroup
            label={t(locale, "ce.activity")}
            options={ACTIVITY_OPTIONS.map((o) => ({ value: o.value, label: t(locale, o.label) }))}
            value={activityLevel}
            onChange={(v) => setActivityLevel(v as DietEssentials["activityLevel"])}
          />

          <div className="flex flex-col gap-1">
            <NumberField
              label={t(locale, "ce.body_fat_pct")}
              value={bodyFatPercent}
              onChange={setBodyFatPercent}
            />
            <p className="text-[11px] leading-relaxed text-muted">
              {t(locale, "ce.body_fat_pct_hint")}
            </p>
          </div>

          {targets && (
            <div className="flex flex-col gap-1 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
              <p className="text-sm font-bold">{t(locale, "cd.targets_ready")}</p>
              <p className="text-xs text-muted">{t(locale, "cd.targets_hint")}</p>
              <p className="pt-1 font-display text-lg font-extrabold tabular-nums">
                {targets.calories} kcal · {targets.proteinG}P / {targets.carbsG}C / {targets.fatG}F
              </p>
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            disabled={!numbersValid}
            size="lg"
            className="w-full"
          >
            {t(locale, "co.next")}
          </Button>
          <Link
            href={isRedo ? "/diet/questions?redo=1" : "/diet/questions"}
            className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            {t(locale, "build.switch_to_guided")}
          </Link>
        </div>
      )}

      {/* ---- 2. fill the meals ---- */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {targets && (
            <MacroRing
              calories={totals.calories}
              caloriesTarget={targets.calories}
              proteinG={totals.proteinG}
              proteinTargetG={targets.proteinG}
              carbsG={totals.carbsG}
              carbsTargetG={targets.carbsG}
              fatG={totals.fatG}
              fatTargetG={targets.fatG}
              dailyTargetLabel={locale === "tn" ? "الهدف اليومي" : "Daily target"}
            />
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t(locale, "cd.meals_count")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_KEYS.map((key) => {
                const chosen = meals.some((m) => m.mealKey === key);
                const hasFood = meals.find((m) => m.mealKey === key)?.items.length ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMeal(key)}
                    disabled={chosen && hasFood > 0}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                      chosen
                        ? "bg-accent text-bg"
                        : "border border-hairline text-muted hover:text-ink",
                      chosen && hasFood > 0 && "opacity-70",
                    )}
                  >
                    {mealLabel(key)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {meals.map((meal, i) => (
              <button
                key={meal.mealKey}
                type="button"
                onClick={() => setActiveMeal(i)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  activeMeal === i
                    ? "bg-accent text-bg"
                    : "border border-hairline text-muted hover:text-ink",
                )}
              >
                {mealLabel(meal.mealKey)}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    activeMeal === i ? "bg-bg/20" : "bg-white/10",
                    meal.items.length === 0 && activeMeal !== i && "text-amber-400",
                  )}
                >
                  {meal.items.length}
                </span>
              </button>
            ))}
          </div>

          {meals[activeMeal] && (
            <MealDraftEditor
              locale={locale}
              meal={meals[activeMeal]}
              foods={foods}
              foodByRef={foodByRef}
              onAdd={(food) => addItem(activeMeal, food)}
              onQuantityChange={(ref, qty) => updateQuantity(activeMeal, ref, qty)}
              onRemove={(ref) => removeItem(activeMeal, ref)}
              onFoodCreated={(food) => {
                setFoods((prev) => [food, ...prev]);
                addItem(activeMeal, food);
              }}
            />
          )}

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <div className="sticky bottom-20 flex gap-2 md:bottom-4">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
              <ArrowLeft className="h-4 w-4" />
              {t(locale, "co.back")}
            </Button>
            <Button onClick={save} disabled={isPending || !canSave} className="flex-[2]">
              {isPending ? t(locale, "build.saving") : t(locale, "cd.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One meal's food list, plus the picker and the "add your own" form. */
function MealDraftEditor({
  locale,
  meal,
  foods,
  foodByRef,
  onAdd,
  onQuantityChange,
  onRemove,
  onFoodCreated,
}: {
  locale: Locale;
  meal: DraftMeal;
  foods: IngredientOption[];
  foodByRef: Map<string, IngredientOption>;
  onAdd: (food: IngredientOption) => void;
  onQuantityChange: (foodRef: string, quantityG: number) => void;
  onRemove: (foodRef: string) => void;
  onFoodCreated: (food: IngredientOption) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);

  // Meal 1 hides the foods the catalog marks as wrong at breakfast (migration
  // 036), the same rule the generator and the swap picker follow. A user's own
  // food carries no such judgement and is always offered.
  const offered = useMemo(
    () => foods.filter((f) => meal.mealKey !== "meal_1" || f.breakfastOk),
    [foods, meal.mealKey],
  );

  return (
    <div className="flex flex-col gap-3">
      {meal.items.length === 0 && !adding && !creating && (
        <p className="rounded-2xl border border-dashed border-hairline bg-surface px-4 py-8 text-center text-sm text-muted">
          {t(locale, "cd.empty_meal")}
        </p>
      )}

      {meal.items.map((item) => {
        const food = foodByRef.get(item.foodRef);
        if (!food) return null;
        const serving = formatServing(locale, item.quantityG, food);
        return (
          <div
            key={item.foodRef}
            className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {pick(locale, food.nameEn, food.nameAr)}
                </span>
                {food.isOwn && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                    {t(locale, "uf.mine")}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted">
                {serving ? `${serving} · ` : ""}
                {Math.round((food.caloriesPer100g * item.quantityG) / 100)} kcal
              </span>
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY_G}
              value={item.quantityG}
              onChange={(e) => {
                const next = Math.round(Number(e.target.value));
                if (Number.isFinite(next)) {
                  onQuantityChange(item.foodRef, Math.min(MAX_QUANTITY_G, Math.max(1, next)));
                }
              }}
              className="h-10 w-20 shrink-0 text-center text-sm"
            />
            <span className="w-4 shrink-0 text-xs text-muted">g</span>
            <button
              type="button"
              onClick={() => onRemove(item.foodRef)}
              aria-label={t(locale, "cw.remove")}
              className="shrink-0 text-muted hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {creating ? (
        <UserFoodForm
          locale={locale}
          onCancel={() => setCreating(false)}
          onCreated={(created) => {
            onFoodCreated({
              id: created.id,
              nameEn: created.name,
              nameAr: created.name,
              slot: created.slot,
              caloriesPer100g: created.caloriesPer100g,
              proteinPer100g: created.proteinPer100g,
              carbsPer100g: created.carbsPer100g,
              fatPer100g: created.fatPer100g,
              imageUrl: null,
              unitEn: null,
              unitEnPlural: null,
              unitAr: null,
              unitArPlural: null,
              unitGrams: null,
              breakfastOk: true,
              isOwn: true,
            });
            setCreating(false);
          }}
        />
      ) : adding ? (
        <div className="rounded-2xl border border-accent/30 bg-surface p-3">
          <IngredientPicker
            locale={locale}
            ingredients={offered}
            placeholder={t(locale, "cd.search_foods")}
            onPick={(food) => {
              onAdd(food);
              setAdding(false);
            }}
            onCreateOwn={() => {
              setAdding(false);
              setCreating(true);
            }}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setAdding(true)}
          disabled={meal.items.length >= MAX_ITEMS_PER_MEAL}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          {t(locale, "cd.add_food")}
        </Button>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-center"
      />
    </label>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  inline = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  inline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className={cn(inline ? "flex flex-wrap gap-2" : "flex flex-col gap-1.5")}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border text-start text-sm font-semibold transition-colors",
              inline ? "px-5 py-2.5" : "px-4 py-3",
              value === option.value
                ? "border-accent bg-accent/5 text-ink ring-1 ring-accent"
                : "border-hairline bg-surface text-muted hover:text-ink",
            )}
          >
            {option.label}
            {value === option.value && !inline && <Check className="h-4 w-4 shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepBar({
  locale,
  step,
  labels,
}: {
  locale: Locale;
  step: number;
  labels: StringKey[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
        {t(locale, "co.step")} {step} {t(locale, "co.of")} {labels.length} ·{" "}
        {t(locale, labels[step - 1])}
      </p>
      <div className="flex gap-1.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < step ? "bg-accent" : "bg-white/10",
            )}
          />
        ))}
      </div>
    </div>
  );
}
