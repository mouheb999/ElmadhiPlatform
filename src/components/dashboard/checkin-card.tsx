"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Battery,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Check,
  Sunrise,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/input";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { cn, parseDecimal } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { submitCheckin } from "@/app/actions/checkins";

export type TodayCheckin = {
  weightKg: number | null;
  energy: number | null;
  sleepHours: number | null;
} | null;

/**
 * Ordered so the batteries fill up left to right — empty, low, half, full,
 * then the lightning bolt. The icon alone has to say "this end is worse than
 * that end" without reading the labels.
 */
const ENERGY_LEVELS: { value: number; icon: typeof Battery; labelKey: StringKey }[] = [
  { value: 1, icon: Battery, labelKey: "checkin.energy_1" },
  { value: 2, icon: BatteryLow, labelKey: "checkin.energy_2" },
  { value: 3, icon: BatteryMedium, labelKey: "checkin.energy_3" },
  { value: 4, icon: BatteryFull, labelKey: "checkin.energy_4" },
  { value: 5, icon: Zap, labelKey: "checkin.energy_5" },
];

/**
 * The 15-second morning check-in that feeds the coaching data spine.
 *
 * On Today it is one row — a prompt, or a summary once done — and the form
 * itself opens in a bottom sheet. An inline form (two number fields and five
 * buttons) sitting in the middle of the home screen was the most web-page
 * thing on it; a sheet that arrives when asked for is how a native app takes
 * a quick input.
 *
 * `presentation="inline"` keeps the old shape for the checkout preview, which
 * renders this exact component inside a small framed phone on a sales page. A
 * sheet portals to <body>, so there it would escape the frame and cover the
 * whole checkout page.
 */
export function CheckinCard({
  locale,
  todayCheckin,
  lastWeightKg,
  onSave,
  presentation = "sheet",
}: {
  locale: Locale;
  todayCheckin: TodayCheckin;
  lastWeightKg: number | null;
  /**
   * Where a saved check-in goes. Defaults to the real Server Function, which
   * is what every screen in the product wants.
   *
   * The checkout preview supplies its own: it renders this exact card for a
   * visitor who has no account yet, and `submitCheckin` would refuse them —
   * correctly, but after a spinner and an error message, on the screen whose
   * whole job is to show the app working. The override keeps the preview
   * honest in the way that matters: it is this component, not a copy of it.
   */
  onSave?: (checkin: {
    weightKg: number | null;
    energy: number | null;
    sleepHours: number | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  presentation?: "sheet" | "inline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(
    todayCheckin?.weightKg != null ? String(todayCheckin.weightKg) : "",
  );
  const [sleep, setSleep] = useState(
    todayCheckin?.sleepHours != null ? String(todayCheckin.sleepHours) : "",
  );
  const [energy, setEnergy] = useState<number | null>(todayCheckin?.energy ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = useCallback(() => setOpen(false), []);
  const done = todayCheckin !== null;

  function save() {
    setError(null);
    startTransition(async () => {
      const payload = {
        weightKg: parseDecimal(weight),
        energy,
        sleepHours: parseDecimal(sleep),
      };
      const result = onSave ? await onSave(payload) : await submitCheckin(payload);
      if (!result.ok) {
        setError(result.error ?? null);
        return;
      }
      setOpen(false);
      // Only the real write has server state to re-read; a caller that handled
      // the save itself already owns whatever needs to change on screen.
      if (!onSave) router.refresh();
    });
  }

  const form = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{t(locale, "checkin.weight")}</span>
          <DecimalInput
            value={weight}
            onValueChange={setWeight}
            placeholder={lastWeightKg != null ? String(lastWeightKg) : "70"}
            className="h-14 bg-surface2 text-center font-num text-[22px] font-bold"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{t(locale, "checkin.sleep")}</span>
          <DecimalInput
            value={sleep}
            onValueChange={setSleep}
            placeholder="7"
            className="h-14 bg-surface2 text-center font-num text-[22px] font-bold"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-muted">{t(locale, "checkin.energy")}</span>
        <div className="flex gap-2">
          {ENERGY_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setEnergy((e) => (e === level.value ? null : level.value))}
              aria-label={t(locale, level.labelKey)}
              aria-pressed={energy === level.value}
              title={t(locale, level.labelKey)}
              className={cn(
                "press grid h-12 flex-1 place-items-center rounded-xl transition-colors",
                energy === level.value ? "bg-sleep text-bg" : "bg-surface2 text-muted",
              )}
            >
              <level.icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        onClick={save}
        disabled={isPending || (!weight.trim() && !sleep.trim() && energy === null)}
        className="w-full"
      >
        {isPending ? t(locale, "checkin.saving") : t(locale, "checkin.save")}
      </Button>
    </div>
  );

  if (presentation === "inline" && (!done || open)) {
    return (
      <div className="card-surface flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fuel/15 text-fuel">
            <Sunrise className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold">{t(locale, "checkin.title")}</div>
            <div className="text-[13px] text-subtle">{t(locale, "checkin.subtitle")}</div>
          </div>
        </div>
        {form}
      </div>
    );
  }

  const summary = done
    ? [
        todayCheckin.weightKg != null ? `${todayCheckin.weightKg} ${t(locale, "session.kg")}` : null,
        todayCheckin.sleepHours != null ? `${todayCheckin.sleepHours} ${t(locale, "home.sleep_h")}` : null,
        todayCheckin.energy != null ? t(locale, ENERGY_LEVELS[todayCheckin.energy - 1].labelKey) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : t(locale, "checkin.subtitle");

  return (
    <>
      <section
        aria-label={t(locale, "checkin.title")}
        className="card-surface flex items-center gap-3.5 py-4 pe-4 ps-5"
      >
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            done ? "bg-train/15 text-train" : "bg-fuel/15 text-fuel",
          )}
        >
          {done ? <Check className="h-5 w-5" strokeWidth={2.6} /> : <Sunrise className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(locale, done ? "checkin.done" : "checkin.title")}</p>
          <p className="mt-0.5 truncate text-[13px] text-subtle">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "press h-10 shrink-0 rounded-full px-[18px] text-[15px] font-bold",
            done ? "bg-surface2 text-ink" : "bg-ink text-bg",
          )}
        >
          {t(locale, done ? "checkin.edit" : "home.log")}
        </button>
      </section>

      {presentation === "sheet" && (
        <BottomSheet
          open={open}
          onClose={close}
          title={t(locale, "checkin.title")}
          cancelLabel={t(locale, "home.cancel")}
        >
          <div className="pt-2">{form}</div>
        </BottomSheet>
      )}
    </>
  );
}
