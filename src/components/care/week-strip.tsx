import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { isoWeekday } from "@/lib/dates";
import type { DayPlan, DayType } from "@/lib/clinical/schedule";
import { careText } from "./care-text";

/**
 * The week as seven typed days.
 *
 * The single most useful thing this product can show him is which of the next
 * seven days are his and which belong to the unit. It is a strip rather than a
 * list because the shape of the week — two clear days, a session, one clear
 * day, a session — is the thing to recognise at a glance.
 */

const DAY_STYLES: Record<DayType, string> = {
  dialysis: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  recovery: "border-white/10 bg-white/[0.03] text-muted",
  training: "border-accent/40 bg-accent/10 text-accent",
  unknown: "border-dashed border-white/20 bg-transparent text-muted",
};

const DAY_LABELS: Record<DayType, StringKey> = {
  dialysis: "care.day_dialysis",
  recovery: "care.day_recovery",
  training: "care.day_training",
  unknown: "care.day_unknown",
};

/** "07:30" in Tunis for a UTC instant, without pulling in a date library. */
function tunisClock(instant: Date): string {
  return new Date(instant.getTime() + 3_600_000).toISOString().slice(11, 16);
}

export function WeekStrip({
  locale,
  week,
  todayKey,
}: {
  locale: Locale;
  week: DayPlan[];
  todayKey: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-muted">
        <CalendarDays className="h-4 w-4" />
        {t(locale, "care.day_training")} · {t(locale, "care.day_dialysis")}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((day) => {
          const isToday = day.dateKey === todayKey;
          return (
            <div
              key={day.dateKey}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center",
                DAY_STYLES[day.type],
                isToday && "ring-2 ring-ink/40",
              )}
            >
              <span className="text-[0.65rem] font-bold uppercase opacity-70">
                {t(locale, `care.dow_${isoWeekday(day.dateKey)}` as StringKey)}
              </span>
              <span className="text-[0.6rem] leading-tight">
                {t(locale, DAY_LABELS[day.type])}
              </span>
              {day.dialysis && (
                <span className="text-[0.6rem] font-mono opacity-70">
                  {tunisClock(day.dialysis.startsAt)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">{careText(locale, week.find((d) => d.dateKey === todayKey)?.reasonKey ?? "")}</p>
    </div>
  );
}
