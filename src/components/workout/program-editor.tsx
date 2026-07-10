"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { pick, t, type Locale } from "@/lib/i18n";
import { ExerciseCard, type EditorExercise, type ExerciseCandidate } from "@/components/workout/exercise-card";
import { WarningBanner } from "@/components/shared/warning-banner";
import { validateProgram } from "@/lib/algorithms/validation";
import { saveProgramExerciseEdit, swapProgramExercise, markProgramModified } from "@/app/actions/training";

export type EditorDay = {
  id: string;
  dayNumber: number;
  dayName: string;
  exercises: (EditorExercise & { primaryMuscle: string })[];
};

export function ProgramEditor({
  locale,
  programId,
  initialDays,
}: {
  locale: Locale;
  programId: string;
  initialDays: EditorDay[];
}) {
  const [days, setDays] = useState(initialDays);
  const [activeDay, setActiveDay] = useState(0);
  const [, startTransition] = useTransition();

  const warnings = validateProgram(days.flatMap((d) => d.exercises.map((e) => e.primaryMuscle)));

  function handleSetsChange(dayIndex: number, rowId: string, sets: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, exercises: d.exercises.map((e) => (e.id === rowId ? { ...e, sets } : e)) } : d)),
    );
    startTransition(() => {
      saveProgramExerciseEdit(rowId, { sets });
      markProgramModified(programId);
    });
  }

  function handleSwap(dayIndex: number, rowId: string, candidate: ExerciseCandidate) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === rowId
                  ? {
                      ...e,
                      exerciseId: candidate.id,
                      nameEn: candidate.nameEn,
                      nameAr: candidate.nameAr,
                      notes: null,
                      // Media belongs to the old exercise; cleared until reload.
                      thumbnailUrl: null,
                      videoUrl: null,
                    }
                  : e,
              ),
            }
          : d,
      ),
    );
    startTransition(() => {
      swapProgramExercise(rowId, candidate.id);
      markProgramModified(programId);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {warnings.map((w) => (
        <WarningBanner key={w.type} message={pick(locale, w.message.en, w.message.ar)} />
      ))}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day, i) => (
          <button
            key={day.id}
            type="button"
            onClick={() => setActiveDay(i)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
              activeDay === i ? "bg-accent text-bg" : "border border-hairline text-muted hover:text-ink",
            )}
          >
            {day.dayName}
          </button>
        ))}
      </div>

      {days[activeDay] && (
        <Link
          href={`/workout/session/${days[activeDay].id}`}
          className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-bg shadow-[0_10px_28px_rgba(93,214,44,0.25)] transition-transform hover:-translate-y-0.5"
        >
          <Play className="h-5 w-5" />
          {t(locale, "workout.start_day")}
        </Link>
      )}

      <div className="flex flex-col gap-3">
        {days[activeDay]?.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            locale={locale}
            exercise={exercise}
            onSetsChange={(sets) => handleSetsChange(activeDay, exercise.id, sets)}
            onSwap={(candidate) => handleSwap(activeDay, exercise.id, candidate)}
          />
        ))}
      </div>
    </div>
  );
}
