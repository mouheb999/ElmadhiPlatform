"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUserFood } from "@/app/actions/custom-diet";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";

/** Same vocabulary as `nutrition_ingredients.slot` — it drives swap options. */
const SLOTS: { value: string; label: StringKey }[] = [
  { value: "protein", label: "uf.slot_protein" },
  { value: "carb", label: "uf.slot_carb" },
  { value: "vegetable", label: "uf.slot_vegetable" },
  { value: "fat", label: "uf.slot_fat" },
  { value: "fruit", label: "uf.slot_fruit" },
  { value: "legume", label: "uf.slot_legume" },
  { value: "beverage", label: "uf.slot_beverage" },
];

export type CreatedUserFood = {
  /** Already encoded as a food ref, ready to hand to any of the actions. */
  id: string;
  name: string;
  slot: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

/**
 * "The thing I eat isn't in your list."
 *
 * Four numbers off a packet and a name. Deliberately not a nutrition database
 * form — no fiber, no micronutrients, no brand, no barcode. Everything the
 * plan and the diary actually compute with is here and nothing else is, because
 * every extra field is another reason to abandon this and log "quick calories"
 * instead, which is the outcome this screen exists to prevent.
 *
 * Per 100 g, matching the catalog, so a swap rescales correctly against it.
 */
export function UserFoodForm({
  locale,
  onCreated,
  onCancel,
}: {
  locale: Locale;
  onCreated: (food: CreatedUserFood) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("protein");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const numbers = {
    caloriesPer100g: Number(calories),
    proteinPer100g: Number(protein || 0),
    carbsPer100g: Number(carbs || 0),
    fatPer100g: Number(fat || 0),
  };
  const macroSum = numbers.proteinPer100g + numbers.carbsPer100g + numbers.fatPer100g;
  const canSubmit =
    name.trim().length > 0 && Number.isFinite(numbers.caloriesPer100g) && numbers.caloriesPer100g > 0;

  function submit() {
    // Checked here as well as on the server, because this is the mistake people
    // actually make — copying a per-serving label into per-100g fields — and
    // catching it before the round-trip lets us point at the cause.
    if (macroSum > 100) {
      setError(t(locale, "uf.macros_exceed"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUserFood({ name: name.trim(), slot, ...numbers });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({
        // Mirrors encodeFoodRef's user-food form. Kept literal rather than
        // imported so this file stays free of server-side helpers.
        id: `uf:${res.data.id}`,
        name: name.trim(),
        slot,
        ...numbers,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-surface p-4">
      <div>
        <p className="font-display font-bold">{t(locale, "uf.title")}</p>
        <p className="text-xs leading-relaxed text-muted">{t(locale, "uf.hint")}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {t(locale, "uf.name")}
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder={t(locale, "uf.name_ph")}
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {t(locale, "uf.kind")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SLOTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSlot(option.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                slot === option.value
                  ? "bg-accent text-bg"
                  : "border border-hairline text-muted hover:text-ink",
              )}
            >
              {t(locale, option.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MacroField label={t(locale, "uf.calories")} value={calories} onChange={setCalories} />
        <MacroField label={t(locale, "uf.protein")} value={protein} onChange={setProtein} />
        <MacroField label={t(locale, "uf.carbs")} value={carbs} onChange={setCarbs} />
        <MacroField label={t(locale, "uf.fat")} value={fat} onChange={setFat} />
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">
          {t(locale, "uf.cancel")}
        </Button>
        <Button size="sm" onClick={submit} disabled={isPending || !canSubmit} className="flex-1">
          {isPending ? t(locale, "build.saving") : t(locale, "uf.save")}
        </Button>
      </div>
    </div>
  );
}

function MacroField({
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
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 text-center text-sm"
      />
    </label>
  );
}
