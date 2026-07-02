"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFood, updateFood, deleteFood } from "@/app/actions/foods";
import {
  FOOD_CATEGORIES,
  PRICE_TIERS,
  type FoodInput,
} from "@/app/actions/foods-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/shared/image-upload";
import { type Locale, dir, pick, t } from "@/lib/i18n";
import type { Database } from "@/types/db";

type FoodRow = Database["public"]["Tables"]["foods"]["Row"];

const selectClass =
  "flex h-12 w-full rounded-2xl border border-hairline bg-surface px-4 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function FoodsClient({
  locale,
  foods,
}: {
  locale: Locale;
  foods: FoodRow[];
}) {
  const [query, setQuery] = useState("");
  // null = list only; "new" = add form; string id = editing that row.
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) =>
      [f.name_ar, f.name_en, f.category]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [foods, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-extrabold">{t(locale, "foods.title")}</h1>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")}>
            {t(locale, "foods.add")}
          </Button>
        )}
      </div>

      {editing === "new" && (
        <FoodForm
          locale={locale}
          food={null}
          onDone={() => setEditing(null)}
        />
      )}

      <Input
        placeholder={t(locale, "foods.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {t(locale, "foods.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((food) =>
            editing === food.id ? (
              <li key={food.id}>
                <FoodForm
                  locale={locale}
                  food={food}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={food.id}>
                <FoodRowItem
                  locale={locale}
                  food={food}
                  onEdit={() => setEditing(food.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function FoodRowItem({
  locale,
  food,
  onEdit,
}: {
  locale: Locale;
  food: FoodRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm(t(locale, "foods.confirm_delete"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteFood(food.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {food.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={food.image_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-hairline object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">
            {pick(locale, food.name_en, food.name_ar)}
          </p>
          <p className="text-sm text-muted">
            {food.category} · {food.calories_per_100g} kcal · P
            {food.protein_per_100g} / C{food.carbs_per_100g} / F
            {food.fat_per_100g}
          </p>
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          {t(locale, "foods.edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={onDelete}
        >
          {t(locale, "foods.delete")}
        </Button>
      </div>
    </div>
  );
}

type FormState = {
  name_ar: string;
  name_en: string;
  category: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  serving: string;
  price: string;
  price_tier: string;
  allergens: string;
  tags: string;
  is_common: boolean;
  image_url: string | null;
};

function initialState(food: FoodRow | null): FormState {
  const num = (n: number | null | undefined) =>
    n === null || n === undefined ? "" : String(n);
  return {
    name_ar: food?.name_ar ?? "",
    name_en: food?.name_en ?? "",
    category: food?.category ?? FOOD_CATEGORIES[0],
    calories: num(food?.calories_per_100g),
    protein: num(food?.protein_per_100g),
    carbs: num(food?.carbs_per_100g),
    fat: num(food?.fat_per_100g),
    fiber: num(food?.fiber_per_100g ?? 0),
    serving: num(food?.typical_serving_g),
    price: num(food?.price_tnd_per_kg),
    price_tier: food?.price_tier ?? "",
    allergens: (food?.allergens ?? []).join(", "),
    tags: (food?.tags ?? []).join(", "),
    is_common: food?.is_common ?? false,
    image_url: food?.image_url ?? null,
  };
}

function toList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function FoodForm({
  locale,
  food,
  onDone,
}: {
  locale: Locale;
  food: FoodRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(food));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const direction = dir(locale);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError(null);
    const input: FoodInput = {
      name_ar: form.name_ar,
      name_en: form.name_en,
      category: form.category,
      calories_per_100g: Number(form.calories),
      protein_per_100g: Number(form.protein),
      carbs_per_100g: Number(form.carbs),
      fat_per_100g: Number(form.fat),
      fiber_per_100g: form.fiber === "" ? 0 : Number(form.fiber),
      typical_serving_g: form.serving === "" ? null : Number(form.serving),
      price_tnd_per_kg: form.price === "" ? null : Number(form.price),
      price_tier: form.price_tier || null,
      allergens: toList(form.allergens),
      tags: toList(form.tags),
      is_common: form.is_common,
      image_url: form.image_url,
    };

    startTransition(async () => {
      const res = food
        ? await updateFood(food.id, input)
        : await createFood(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "foods.name_ar")}>
            <Input
              dir="rtl"
              value={form.name_ar}
              onChange={(e) => set("name_ar", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "foods.name_en")}>
            <Input
              dir="ltr"
              value={form.name_en}
              onChange={(e) => set("name_en", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "foods.category")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t(locale, "foods.price_tier")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.price_tier}
              onChange={(e) => set("price_tier", e.target.value)}
            >
              <option value="">{t(locale, "foods.none")}</option>
              {PRICE_TIERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField
            label={t(locale, "foods.calories")}
            value={form.calories}
            onChange={(v) => set("calories", v)}
          />
          <NumberField
            label={t(locale, "foods.protein")}
            value={form.protein}
            onChange={(v) => set("protein", v)}
          />
          <NumberField
            label={t(locale, "foods.carbs")}
            value={form.carbs}
            onChange={(v) => set("carbs", v)}
          />
          <NumberField
            label={t(locale, "foods.fat")}
            value={form.fat}
            onChange={(v) => set("fat", v)}
          />
          <NumberField
            label={t(locale, "foods.fiber")}
            value={form.fiber}
            onChange={(v) => set("fiber", v)}
          />
          <NumberField
            label={t(locale, "foods.serving")}
            value={form.serving}
            onChange={(v) => set("serving", v)}
          />
          <NumberField
            label={t(locale, "foods.price")}
            value={form.price}
            onChange={(v) => set("price", v)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "foods.allergens")}>
            <Input
              dir={direction}
              value={form.allergens}
              onChange={(e) => set("allergens", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "foods.tags")}>
            <Input
              dir={direction}
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </Field>
        </div>

        <ImageUpload
          locale={locale}
          bucket="food-images"
          value={form.image_url}
          onChange={(url) => set("image_url", url)}
        />

        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.is_common}
            onChange={(e) => set("is_common", e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          {t(locale, "foods.is_common")}
        </label>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={isPending}>
            {t(locale, "foods.save")}
          </Button>
          <Button variant="ghost" onClick={onDone} disabled={isPending}>
            {t(locale, "foods.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
