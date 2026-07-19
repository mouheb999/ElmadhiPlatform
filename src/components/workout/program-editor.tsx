"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Lock, Play, Trophy } from "lucide-react";
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

/** Weekly-gate state of a program day (server-computed, Tunis week). */
export type DayStatus =
  | { state: "available" }
  | { state: "in_progress" }
  | {
      state: "completed";
      stats: { volumeKg: number; setCount: number; minutes: number; prCount: number };
    };

export function ProgramEditor({
  locale,
  programId,
  initialDays,
  dayStatus,
}: {
  locale: Locale;
  programId: string;
  initialDays: EditorDay[];
  dayStatus: Record<string, DayStatus>;
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
        {days.map((day, i) => {
          const status = dayStatus[day.id] ?? { state: "available" };
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveDay(i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                activeDay === i ? "bg-accent text-bg" : "border border-hairline text-muted hover:text-ink",
              )}
            >
              {day.dayName}
              {status.state === "completed" && (
                <Check className={cn("h-3.5 w-3.5", activeDay === i ? "text-bg" : "text-accent")} />
              )}
              {status.state === "in_progress" && (
                <span
                  className={cn(
                    "h-2 w-2 animate-pulse rounded-full",
                    activeDay === i ? "bg-bg" : "bg-accent",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {days[activeDay] && (
        <DayAction
          locale={locale}
          dayId={days[activeDay].id}
          status={dayStatus[days[activeDay].id] ?? { state: "available" }}
        />
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

/** The day's call-to-action: start, continue, or the locked recap card. */
function DayAction({
  locale,
  dayId,
  status,
}: {
  locale: Locale;
  dayId: string;
  status: DayStatus;
}) {
  if (status.state === "completed") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex items-center gap-2 font-bold text-accent">
          <CheckCircle2 className="h-5 w-5" />
          {t(locale, "workout.day_done")}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <MiniStat value={String(status.stats.setCount)} label={t(locale, "session.stat_sets")} />
          <MiniStat value={String(status.stats.volumeKg)} label={t(locale, "session.stat_volume")} />
          <MiniStat value={String(status.stats.minutes)} label={t(locale, "session.stat_minutes")} />
          <MiniStat
            value={String(status.stats.prCount)}
            label={t(locale, "session.stat_prs")}
            icon={status.stats.prCount > 0 ? <Trophy className="h-3 w-3 text-accent" /> : undefined}
          />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-muted">
          <Lock className="h-3.5 w-3.5" />
          {t(locale, "workout.locked_until_monday")}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/workout/session/${dayId}`}
      className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-bg shadow-[0_10px_28px_rgba(93,214,44,0.25)] transition-transform hover:-translate-y-0.5"
    >
      <Play className="h-5 w-5" />
      {status.state === "in_progress"
        ? t(locale, "workout.continue_day")
        : t(locale, "workout.start_day")}
    </Link>
  );
}

function MiniStat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-1 py-2">
      <div className="flex items-center justify-center gap-1 text-base font-extrabold tabular-nums">
        {icon}
        {value}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
