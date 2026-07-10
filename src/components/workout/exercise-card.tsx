"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExerciseMedia } from "@/components/workout/exercise-media";
import { pick, type Locale } from "@/lib/i18n";

export type ExerciseCandidate = { id: string; nameEn: string | null; nameAr: string | null };

export type EditorExercise = {
  id: string;
  exerciseId: string;
  nameEn: string | null;
  nameAr: string | null;
  sets: number;
  repRange: string;
  restSeconds: number;
  notes: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  substitutes: ExerciseCandidate[];
};

export function ExerciseCard({
  locale,
  exercise,
  onSetsChange,
  onSwap,
}: {
  locale: Locale;
  exercise: EditorExercise;
  onSetsChange: (sets: number) => void;
  onSwap: (candidate: ExerciseCandidate) => void;
}) {
  const [swapping, setSwapping] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ExerciseMedia
            locale={locale}
            name={pick(locale, exercise.nameEn, exercise.nameAr)}
            thumbnailUrl={exercise.thumbnailUrl}
            videoUrl={exercise.videoUrl}
            size="sm"
          />
          <div className="min-w-0">
            <div className="truncate font-bold">{pick(locale, exercise.nameEn, exercise.nameAr)}</div>
            <div className="text-sm text-muted">
              {exercise.sets} × {exercise.repRange} · {exercise.restSeconds}s {locale === "tn" ? "راحة" : "rest"}
            </div>
            {exercise.notes && <div className="mt-1 text-xs text-amber-300">{exercise.notes}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={exercise.sets}
            onChange={(e) => onSetsChange(Number(e.target.value))}
            className="h-10 w-14 text-center text-sm"
          />
          {exercise.substitutes.length > 0 && (
            <button
              type="button"
              onClick={() => setSwapping((s) => !s)}
              aria-label="Swap exercise"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-muted hover:text-ink"
            >
              <Repeat className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {swapping && (
        <div className="flex flex-col gap-1 border-t border-hairline pt-2">
          {exercise.substitutes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSwap(c);
                setSwapping(false);
              }}
              className="rounded-xl px-3 py-2 text-start text-sm hover:bg-white/5"
            >
              {pick(locale, c.nameEn, c.nameAr)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
