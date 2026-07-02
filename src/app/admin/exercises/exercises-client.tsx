"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExercise,
  updateExercise,
  deleteExercise,
} from "@/app/actions/exercises";
import {
  PRIMARY_MUSCLES,
  EQUIPMENT,
  MOVEMENT_PATTERNS,
  DIFFICULTIES,
  type ExerciseInput,
} from "@/app/actions/exercises-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/shared/image-upload";
import { type Locale, dir, pick, t } from "@/lib/i18n";
import type { Database } from "@/types/db";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

const selectClass =
  "flex h-12 w-full rounded-2xl border border-hairline bg-surface px-4 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const textareaClass =
  "flex min-h-24 w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function ExercisesClient({
  locale,
  exercises,
}: {
  locale: Locale;
  exercises: ExerciseRow[];
}) {
  const [query, setQuery] = useState("");
  // null = list only; "new" = add form; string id = editing that row.
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) =>
      [e.name_ar, e.name_en, e.primary_muscle, e.equipment]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [exercises, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-extrabold">{t(locale, "ex.title")}</h1>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")}>
            {t(locale, "ex.add")}
          </Button>
        )}
      </div>

      {editing === "new" && (
        <ExerciseForm
          locale={locale}
          exercise={null}
          onDone={() => setEditing(null)}
        />
      )}

      <Input
        placeholder={t(locale, "ex.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {t(locale, "ex.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((exercise) =>
            editing === exercise.id ? (
              <li key={exercise.id}>
                <ExerciseForm
                  locale={locale}
                  exercise={exercise}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={exercise.id}>
                <ExerciseRowItem
                  locale={locale}
                  exercise={exercise}
                  onEdit={() => setEditing(exercise.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function ExerciseRowItem({
  locale,
  exercise,
  onEdit,
}: {
  locale: Locale;
  exercise: ExerciseRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm(t(locale, "ex.confirm_delete"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteExercise(exercise.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {exercise.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.thumbnail_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-hairline object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">
            {pick(locale, exercise.name_en, exercise.name_ar)}
          </p>
          <p className="text-sm text-muted">
            {exercise.primary_muscle} · {exercise.equipment}
            {exercise.difficulty ? ` · ${exercise.difficulty}` : ""}
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
          {t(locale, "ex.edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={onDelete}
        >
          {t(locale, "ex.delete")}
        </Button>
      </div>
    </div>
  );
}

type FormState = {
  name_ar: string;
  name_en: string;
  primary_muscle: string;
  secondary_muscles: string;
  equipment: string;
  movement_pattern: string;
  difficulty: string;
  contraindicated_for: string;
  video_url: string;
  instructions: string;
  thumbnail_url: string | null;
};

function initialState(exercise: ExerciseRow | null): FormState {
  return {
    name_ar: exercise?.name_ar ?? "",
    name_en: exercise?.name_en ?? "",
    primary_muscle: exercise?.primary_muscle ?? PRIMARY_MUSCLES[0],
    secondary_muscles: (exercise?.secondary_muscles ?? []).join(", "),
    equipment: exercise?.equipment ?? EQUIPMENT[0],
    movement_pattern: exercise?.movement_pattern ?? "",
    difficulty: exercise?.difficulty ?? "",
    contraindicated_for: (exercise?.contraindicated_for ?? []).join(", "),
    video_url: exercise?.video_url ?? "",
    instructions: exercise?.instructions ?? "",
    thumbnail_url: exercise?.thumbnail_url ?? null,
  };
}

function toList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ExerciseForm({
  locale,
  exercise,
  onDone,
}: {
  locale: Locale;
  exercise: ExerciseRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(exercise));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const direction = dir(locale);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError(null);
    const input: ExerciseInput = {
      name_ar: form.name_ar,
      name_en: form.name_en,
      primary_muscle: form.primary_muscle,
      secondary_muscles: toList(form.secondary_muscles),
      equipment: form.equipment,
      movement_pattern: form.movement_pattern || null,
      difficulty: form.difficulty || null,
      contraindicated_for: toList(form.contraindicated_for),
      video_url: form.video_url.trim() || null,
      thumbnail_url: form.thumbnail_url,
      instructions: form.instructions.trim() || null,
    };

    startTransition(async () => {
      const res = exercise
        ? await updateExercise(exercise.id, input)
        : await createExercise(input);
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
          <Field label={t(locale, "ex.name_ar")}>
            <Input
              dir="rtl"
              value={form.name_ar}
              onChange={(e) => set("name_ar", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "ex.name_en")}>
            <Input
              dir="ltr"
              value={form.name_en}
              onChange={(e) => set("name_en", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "ex.primary_muscle")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.primary_muscle}
              onChange={(e) => set("primary_muscle", e.target.value)}
            >
              {PRIMARY_MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t(locale, "ex.equipment")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.equipment}
              onChange={(e) => set("equipment", e.target.value)}
            >
              {EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t(locale, "ex.movement_pattern")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.movement_pattern}
              onChange={(e) => set("movement_pattern", e.target.value)}
            >
              <option value="">{t(locale, "foods.none")}</option>
              {MOVEMENT_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t(locale, "ex.difficulty")}>
            <select
              dir={direction}
              className={selectClass}
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
            >
              <option value="">{t(locale, "foods.none")}</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "ex.secondary_muscles")}>
            <Input
              dir={direction}
              value={form.secondary_muscles}
              onChange={(e) => set("secondary_muscles", e.target.value)}
            />
          </Field>
          <Field label={t(locale, "ex.contraindicated_for")}>
            <Input
              dir={direction}
              value={form.contraindicated_for}
              onChange={(e) => set("contraindicated_for", e.target.value)}
            />
          </Field>
        </div>

        <Field label={t(locale, "ex.video_url")}>
          <Input
            dir="ltr"
            value={form.video_url}
            onChange={(e) => set("video_url", e.target.value)}
          />
        </Field>

        <Field label={t(locale, "ex.instructions")}>
          <textarea
            dir={direction}
            className={textareaClass}
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
          />
        </Field>

        <ImageUpload
          locale={locale}
          bucket="exercise-images"
          value={form.thumbnail_url}
          onChange={(url) => set("thumbnail_url", url)}
        />

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={isPending}>
            {t(locale, "ex.save")}
          </Button>
          <Button variant="ghost" onClick={onDone} disabled={isPending}>
            {t(locale, "ex.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
