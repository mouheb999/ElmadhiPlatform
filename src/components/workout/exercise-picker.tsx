"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { pick, t, type Locale } from "@/lib/i18n";

/** The shape both the builder and the program editor pass in. */
export type PickableExercise = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  /** NULL for the cardio/stretching rows added in migration 019. */
  primaryMuscle: string | null;
  equipment: string;
};

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "biceps",
  "triceps",
  "core",
  "forearms",
] as const;

export const MUSCLE_LABELS: Record<string, { en: string; ar: string }> = {
  chest: { en: "Chest", ar: "صدر" },
  back: { en: "Back", ar: "ظهر" },
  shoulders: { en: "Shoulders", ar: "أكتاف" },
  quads: { en: "Quads", ar: "أمامي الفخذ" },
  hamstrings: { en: "Hamstrings", ar: "خلفي الفخذ" },
  glutes: { en: "Glutes", ar: "مؤخرة" },
  calves: { en: "Calves", ar: "سمانة" },
  biceps: { en: "Biceps", ar: "بيسپس" },
  triceps: { en: "Triceps", ar: "ترايسپس" },
  core: { en: "Core", ar: "وسط" },
  forearms: { en: "Forearms", ar: "ساعد" },
};

/** Cap on rendered rows. The catalog is 213 items; nobody scrolls past this. */
const MAX_RESULTS = 60;

/**
 * Search + muscle filter over the exercise catalog, entirely client-side.
 *
 * The whole catalog is short strings and already in memory on both screens that
 * use this, so there is no search endpoint: a picker that waits on a round-trip
 * per keystroke is a picker nobody finishes on a phone on Tunisian mobile data.
 *
 * Stays open after a pick on purpose. Filling a day means adding several in a
 * row, and closing after each one turns six taps into eighteen.
 */
export function ExercisePicker({
  locale,
  exercises,
  chosenIds,
  full = false,
  onPick,
  onClose,
}: {
  locale: Locale;
  exercises: PickableExercise[];
  /** Already in this day — shown ticked and unselectable rather than hidden,
   *  so the list doesn't reshuffle under the finger after every tap. */
  chosenIds: Set<string>;
  full?: boolean;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arabicQuery = query.trim();
    return exercises
      .filter((e) => (muscle ? e.primaryMuscle === muscle : true))
      .filter((e) =>
        q ? e.nameEn.toLowerCase().includes(q) || (e.nameAr ?? "").includes(arabicQuery) : true,
      )
      .slice(0, MAX_RESULTS);
  }, [exercises, query, muscle]);

  function muscleLabel(value: string | null): string | null {
    if (!value) return null;
    const entry = MUSCLE_LABELS[value];
    if (!entry) return null;
    return locale === "tn" ? entry.ar : entry.en;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "cw.search_exercises")}
            className="ps-11"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t(locale, "uf.cancel")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hairline text-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip active={muscle === null} onClick={() => setMuscle(null)}>
          {t(locale, "cw.filter_all")}
        </FilterChip>
        {MUSCLES.map((m) => (
          <FilterChip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
            {muscleLabel(m)}
          </FilterChip>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t(locale, "cw.no_exercises_found")}</p>
      ) : (
        <div className="flex max-h-72 flex-col divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
          {results.map((exercise) => {
            const chosen = chosenIds.has(exercise.id);
            const disabled = chosen || full;
            const muscleText = muscleLabel(exercise.primaryMuscle);
            return (
              <button
                key={exercise.id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(exercise.id)}
                className={cn(
                  "flex items-center justify-between gap-3 bg-bg p-3 text-start transition-colors",
                  disabled ? "opacity-50" : "hover:bg-white/5",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {pick(locale, exercise.nameEn, exercise.nameAr)}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {[muscleText, exercise.equipment].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {chosen ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-accent" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
        active ? "bg-accent text-bg" : "border border-hairline text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
