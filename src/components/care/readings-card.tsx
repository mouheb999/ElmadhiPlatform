"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, Droplet, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { fromMgdl, glucoseDecimals, type GlucoseUnit } from "@/lib/clinical/types";
import { logBloodPressure, logGlucose } from "@/app/actions/clinical";
import { careText } from "./care-text";

/**
 * The two numbers taken either side of a session.
 *
 * The card shows the reading it already has rather than an empty field: the
 * point of "check before, check after" is that the check is visible, and a
 * form that looks unfilled after he filled it is a form he fills twice.
 *
 * What the browser sends is a measurement and a unit. It never sends a
 * verdict — the server judges it against the range on his file (see
 * `actions/clinical.ts`), which is what stops a block being tapped past.
 */

const UNIT_LABELS: Record<GlucoseUnit, string> = {
  g_l: "g/L",
  mg_dl: "mg/dL",
  mmol_l: "mmol/L",
};

type Timing = "pre_session" | "post_session" | "spot";

export function ReadingsCard({
  locale,
  unit,
  needsGlucose,
  needsBp,
  glucoseMgdl,
  bp,
  glucoseReasonKey,
  bpReasonKey,
  timing = "pre_session",
  sessionId = null,
}: {
  locale: Locale;
  unit: GlucoseUnit;
  /** False for someone not on insulin — the row is not rendered at all. */
  needsGlucose: boolean;
  needsBp: boolean;
  glucoseMgdl: number | null;
  bp: { systolic: number; diastolic: number } | null;
  /** The verdict copy for a reading already taken, from the gates. */
  glucoseReasonKey: string | null;
  bpReasonKey: string | null;
  timing?: Timing;
  sessionId?: string | null;
}) {
  const router = useRouter();
  const [glucose, setGlucose] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitGlucose = () => {
    const value = parseDecimal(glucose);
    if (value === null) return;
    setError(null);
    startTransition(async () => {
      const result = await logGlucose({ value, unit, timing, sessionId });
      if (!result.ok) setError(result.error);
      else {
        setGlucose("");
        router.refresh();
      }
    });
  };

  const submitBp = () => {
    const sys = parseDecimal(systolic);
    const dia = parseDecimal(diastolic);
    if (sys === null || dia === null) return;
    setError(null);
    startTransition(async () => {
      const result = await logBloodPressure({
        systolic: Math.round(sys),
        diastolic: Math.round(dia),
        timing,
        sessionId,
      });
      if (!result.ok) setError(result.error);
      else {
        setSystolic("");
        setDiastolic("");
        router.refresh();
      }
    });
  };

  if (!needsGlucose && !needsBp) return null;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Activity className="h-5 w-5 text-accent" />
        {t(locale, "care.checks_title")}
      </h2>

      {needsGlucose && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Droplet className="h-4 w-4 text-muted" />
            {t(locale, "care.check_glucose")}
          </div>
          {glucoseMgdl !== null ? (
            <Taken
              locale={locale}
              value={`${fromMgdl(glucoseMgdl, unit).toFixed(glucoseDecimals(unit))} ${UNIT_LABELS[unit]}`}
              reasonKey={glucoseReasonKey}
            />
          ) : (
            <div className="flex items-center gap-2">
              <DecimalInput
                value={glucose}
                onValueChange={setGlucose}
                placeholder={UNIT_LABELS[unit]}
                aria-label={t(locale, "care.check_glucose")}
                className="max-w-32"
              />
              <Button size="sm" onClick={submitGlucose} disabled={isPending || !glucose}>
                {t(locale, "care.save_reading")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">{t(locale, "care.fast_carbs")}</p>
        </div>
      )}

      {needsBp && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <HeartPulse className="h-4 w-4 text-muted" />
            {t(locale, "care.check_bp")}
          </div>
          {bp !== null ? (
            <Taken locale={locale} value={`${bp.systolic}/${bp.diastolic}`} reasonKey={bpReasonKey} />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="120"
                aria-label="systolic"
                className="max-w-20"
              />
              <span className="text-muted">/</span>
              <Input
                inputMode="numeric"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="80"
                aria-label="diastolic"
                className="max-w-20"
              />
              <Button size="sm" onClick={submitBp} disabled={isPending || !systolic || !diastolic}>
                {t(locale, "care.save_reading")}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm font-bold text-red-400">{error}</p>}
    </section>
  );
}

/** A reading already on record, with the verdict the server attached to it. */
function Taken({
  locale,
  value,
  reasonKey,
}: {
  locale: Locale;
  value: string;
  reasonKey: string | null;
}) {
  // A verdict the app was not qualified to give reads as a caution, not a tick.
  const unjudged =
    reasonKey === "care.glucose_no_range" || reasonKey === "care.bp_no_threshold";
  const blocked =
    reasonKey === "care.glucose_below" ||
    reasonKey === "care.glucose_above" ||
    reasonKey === "care.bp_above_threshold";

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-bold",
          blocked ? "text-red-400" : unjudged ? "text-amber-300" : "text-accent",
        )}
      >
        {blocked || unjudged ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span className="font-mono">{value}</span>
        <span className="font-normal text-muted">· {t(locale, "care.check_taken")}</span>
      </div>
      {reasonKey && <p className="text-xs text-muted">{careText(locale, reasonKey)}</p>}
    </div>
  );
}
