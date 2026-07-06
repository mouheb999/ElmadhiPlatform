"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { submitCheckin } from "@/app/actions/checkins";

export type TodayCheckin = {
  weightKg: number | null;
  energy: number | null;
  sleepHours: number | null;
} | null;

const ENERGY_LEVELS = [
  { value: 1, emoji: "🥱" },
  { value: 2, emoji: "😕" },
  { value: 3, emoji: "🙂" },
  { value: 4, emoji: "😄" },
  { value: 5, emoji: "🔥" },
];

/** The 15-second morning check-in that feeds the coaching data spine. */
export function CheckinCard({
  locale,
  todayCheckin,
  lastWeightKg,
}: {
  locale: Locale;
  todayCheckin: TodayCheckin;
  lastWeightKg: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(
    todayCheckin?.weightKg != null ? String(todayCheckin.weightKg) : "",
  );
  const [sleep, setSleep] = useState(
    todayCheckin?.sleepHours != null ? String(todayCheckin.sleepHours) : "",
  );
  const [energy, setEnergy] = useState<number | null>(todayCheckin?.energy ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const doneForToday = todayCheckin !== null && !editing;

  if (doneForToday) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <CheckCircle2 className="h-5 w-5" />
          {t(locale, "checkin.done")}
          {todayCheckin.weightKg != null && (
            <span className="font-normal text-muted">
              · {todayCheckin.weightKg} {t(locale, "session.kg")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm font-bold text-muted hover:text-ink"
        >
          {t(locale, "checkin.edit")}
        </button>
      </div>
    );
  }

  function save() {
    setError(null);
    const weightKg = weight.trim() ? parseFloat(weight) : null;
    const sleepHours = sleep.trim() ? parseFloat(sleep) : null;
    startTransition(async () => {
      const result = await submitCheckin({
        weightKg: Number.isFinite(weightKg as number) ? weightKg : null,
        energy,
        sleepHours: Number.isFinite(sleepHours as number) ? sleepHours : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center gap-3">
        <Sunrise className="h-6 w-6 shrink-0 text-accent" />
        <div>
          <div className="font-bold">{t(locale, "checkin.title")}</div>
          <div className="text-sm text-muted">{t(locale, "checkin.subtitle")}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">{t(locale, "checkin.weight")}</span>
          <Input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={lastWeightKg != null ? String(lastWeightKg) : "70"}
            className="h-11 text-center"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">{t(locale, "checkin.sleep")}</span>
          <Input
            type="number"
            inputMode="decimal"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="7"
            className="h-11 text-center"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted">{t(locale, "checkin.energy")}</span>
        <div className="flex gap-2">
          {ENERGY_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setEnergy((e) => (e === level.value ? null : level.value))}
              aria-label={`Energy ${level.value}`}
              className={cn(
                "grid h-11 flex-1 place-items-center rounded-xl border text-xl transition-colors",
                energy === level.value
                  ? "border-accent bg-accent/15"
                  : "border-hairline hover:bg-white/5",
              )}
            >
              {level.emoji}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        size="sm"
        onClick={save}
        disabled={isPending || (!weight.trim() && !sleep.trim() && energy === null)}
      >
        {isPending ? t(locale, "checkin.saving") : t(locale, "checkin.save")}
      </Button>
    </div>
  );
}
