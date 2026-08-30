"use client";

import { useState, useTransition } from "react";
import { Footprints, Info, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import {
  MAX_CARDIO_MINUTES,
  MIN_CARDIO_MINUTES,
  cardioPlacement,
  type CardioSchedule,
} from "@/lib/algorithms/cardio";
import { setDayCardio, removeDayCardio } from "@/app/actions/cardio";

export type DayCardio = { minutes: number } | null;

/**
 * The cardio block on a program day.
 *
 * Sits BELOW the exercise list and outside it, which is the whole point: the
 * sheet says cardio must not change the split, the exercises, the sets or the
 * reps, so it is not an `ExerciseCard` with a different icon — it has no sets,
 * no load, no swap list and no progression, and it never enters the muscle
 * coverage the validator counts.
 *
 * On a legs day it renders the placement warning rather than hiding the
 * control. The rule from the sheet is "avoid after legs", not "forbidden", and
 * a user with exactly one free evening should be told why rather than blocked.
 */
export function CardioCard({
  locale,
  dayId,
  dayName,
  cardio,
  schedule,
  defaultMinutes,
  editable,
  onChange,
}: {
  locale: Locale;
  dayId: string;
  dayName: string;
  cardio: DayCardio;
  schedule: CardioSchedule;
  defaultMinutes: number;
  /** False once the day is recorded for the week — its session is history. */
  editable: boolean;
  onChange: (next: DayCardio) => void;
}) {
  const [minutes, setMinutes] = useState(cardio?.minutes ?? defaultMinutes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const placement = cardioPlacement(dayName);

  function save(nextMinutes: number) {
    setError(null);
    const clamped = Math.max(MIN_CARDIO_MINUTES, Math.min(MAX_CARDIO_MINUTES, nextMinutes));
    setMinutes(clamped);
    onChange({ minutes: clamped });
    startTransition(async () => {
      const res = await setDayCardio(dayId, clamped);
      if (!res.ok) {
        setError(res.error);
        onChange(cardio);
      }
    });
  }

  function remove() {
    setError(null);
    onChange(null);
    startTransition(async () => {
      const res = await removeDayCardio(dayId);
      if (!res.ok) {
        setError(res.error);
        onChange(cardio);
      }
    });
  }

  const scheduleLabel = t(locale, "cardio.schedule")
    .replace(
      "{times}",
      schedule.minPerWeek === schedule.maxPerWeek
        ? String(schedule.minPerWeek)
        : `${schedule.minPerWeek}–${schedule.maxPerWeek}`,
    )
    .replace(
      "{minutes}",
      schedule.minMinutes === schedule.maxMinutes
        ? String(schedule.minMinutes)
        : `${schedule.minMinutes}–${schedule.maxMinutes}`,
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <Footprints className="h-4 w-4 text-accent" />
        <span className="font-display text-sm font-bold">{t(locale, "cardio.title")}</span>
      </div>

      {cardio ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-bold">{t(locale, "cardio.speed_walking")}</span>
              <span className="text-xs text-muted">{t(locale, "cardio.intensity")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t(locale, "cardio.less")}
                disabled={!editable || isPending || minutes <= MIN_CARDIO_MINUTES}
                onClick={() => save(minutes - 5)}
                className="grid h-8 w-8 place-items-center rounded-full border border-hairline font-bold disabled:opacity-40"
              >
                −
              </button>
              <span className="w-16 text-center text-sm font-extrabold tabular-nums">
                {minutes} {t(locale, "cardio.min")}
              </span>
              <button
                type="button"
                aria-label={t(locale, "cardio.more")}
                disabled={!editable || isPending || minutes >= MAX_CARDIO_MINUTES}
                onClick={() => save(minutes + 5)}
                className="grid h-8 w-8 place-items-center rounded-full border border-hairline font-bold disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {editable && (
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="flex items-center gap-1 self-start text-xs font-bold text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              {t(locale, "cardio.remove")}
            </button>
          )}
        </>
      ) : (
        editable && (
          <Button variant="secondary" onClick={() => save(defaultMinutes)} disabled={isPending}>
            <Plus className="h-4 w-4" />
            {t(locale, "cardio.add")}
          </Button>
        )
      )}

      {placement === "discouraged" && (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-2.5",
            "text-[11px] leading-relaxed text-amber-200",
          )}
        >
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          {t(locale, "cardio.avoid_legs")}
        </p>
      )}

      {/* The sentence the sheet asks for, verbatim in intent: cardio is here
          for the heart, and it changes neither the food nor the workout. */}
      <p className="text-[11px] leading-relaxed text-muted">{t(locale, "cardio.why")}</p>
      <p className="text-[11px] leading-relaxed text-muted">{scheduleLabel}</p>

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
