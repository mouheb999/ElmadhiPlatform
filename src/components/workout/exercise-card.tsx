"use client";

import { useState } from "react";
import { Minus, Plus, Repeat, Trash2 } from "lucide-react";
import { ExerciseMedia } from "@/components/workout/exercise-media";
import { illustrationFor } from "@/lib/exercise-illustrations";
import { pick, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MAX_SETS } from "@/lib/program-limits";

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
  onRemove,
}: {
  locale: Locale;
  exercise: EditorExercise;
  onSetsChange: (sets: number) => void;
  onSwap: (candidate: ExerciseCandidate) => void;
  /** Omitted when removing isn't allowed — a day must keep one exercise. */
  onRemove?: () => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const name = pick(locale, exercise.nameEn, exercise.nameAr);

  /*
   * Two rows. The top one is the exercise — picture, then the name with room
   * for two full lines, then reps and rest — and nothing else, so a name like
   * "Incline Dumbbell Press" is never cut to "Incline ...". The controls moved
   * to a row of their own underneath: the set count as a stepper (a bare
   * number field invited typing "30"), then swap and remove as grey discs.
   */
  return (
    <div className="card-surface flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <ExerciseMedia
          locale={locale}
          name={name}
          illustrationUrl={illustrationFor(exercise.nameEn)}
          thumbnailUrl={exercise.thumbnailUrl}
          videoUrl={exercise.videoUrl}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[17px] font-semibold leading-snug">{name}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            <bdi dir="ltr">{exercise.repRange}</bdi> {t(locale, "tour.s_reps")} · {exercise.restSeconds}s{" "}
            {t(locale, "session.rest")}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <div className="flex items-center gap-2">
          <StepDisc
            label={t(locale, "workout.fewer_sets")}
            disabled={exercise.sets <= 1}
            onClick={() => onSetsChange(exercise.sets - 1)}
          >
            <Minus className="h-4 w-4" strokeWidth={2.6} />
          </StepDisc>
          <span className="flex min-w-[4.5rem] items-baseline justify-center gap-1 text-train">
            <span className="font-num text-[22px] font-bold leading-none">{exercise.sets}</span>
            <span className="text-[13px] font-bold uppercase">{t(locale, "session.stat_sets")}</span>
          </span>
          <StepDisc
            label={t(locale, "workout.more_sets")}
            disabled={exercise.sets >= MAX_SETS}
            onClick={() => onSetsChange(exercise.sets + 1)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
          </StepDisc>
        </div>

        <div className="flex items-center gap-2">
          {exercise.substitutes.length > 0 && (
            <button
              type="button"
              onClick={() => setSwapping((s) => !s)}
              aria-label="Swap exercise"
              aria-expanded={swapping}
              className={cn(
                "press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-ink",
                swapping && "bg-accent/15 text-accent",
              )}
            >
              <Repeat className="h-[18px] w-[18px]" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove exercise"
              className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-muted hover:text-danger"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {swapping && (
        <div className="flex flex-col gap-1 border-t border-hairline pt-2">
          {exercise.substitutes.map((c) => {
            const candidateIllustration = illustrationFor(c.nameEn);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSwap(c);
                  setSwapping(false);
                }}
                className="press flex items-center gap-3 rounded-[14px] px-2 py-2 text-start text-[15px] font-semibold hover:bg-white/5"
              >
                {candidateIllustration ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pre-optimized local asset
                  <img
                    src={candidateIllustration}
                    alt=""
                    loading="lazy"
                    className="h-10 w-[3.75rem] shrink-0 rounded-[10px] bg-[#161616] object-cover"
                  />
                ) : (
                  <span className="h-10 w-[3.75rem] shrink-0 rounded-[10px] bg-white/5" />
                )}
                {pick(locale, c.nameEn, c.nameAr)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepDisc({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-ink disabled:opacity-35"
    >
      {children}
    </button>
  );
}
