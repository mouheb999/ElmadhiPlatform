"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { fromMgdl, type ClinicalProfile, type GlucoseUnit } from "@/lib/clinical/types";
import { saveClinicalFile } from "@/app/actions/clinical";

/**
 * The clinical file — the four clinicians' answers, transcribed.
 *
 * This form is the only place in HYPE FITNESS where a person types a number
 * that will later stop a workout, so it is built to make transcription hard to
 * get wrong rather than to be quick: every gate is a named choice with an
 * explicit "not on file" option, and next to each one is a field asking WHO
 * said it and WHEN. A clearance with nobody's name on it is a clearance
 * somebody will eventually have to re-chase, and the field is the reminder.
 *
 * "Not on file" is always first in the list and always the default. It is not
 * a failure state to be cleared as fast as possible — for most of these it is
 * the honest answer for weeks, and the app behaves correctly the whole time.
 */

type Option = { value: string; labelKey: StringKey };

const WEIGHT_BEARING: Option[] = [
  { value: "unknown", labelKey: "care.opt_unknown" },
  { value: "none", labelKey: "care.opt_none" },
  { value: "partial", labelKey: "care.opt_partial" },
  { value: "full", labelKey: "care.opt_full" },
];

const BP_CLEARANCE: Option[] = [
  { value: "unknown", labelKey: "care.opt_unknown" },
  { value: "not_cleared", labelKey: "care.opt_not_cleared" },
  { value: "light_only", labelKey: "care.opt_light_only" },
  { value: "moderate", labelKey: "care.opt_moderate" },
];

const ACCESS: Option[] = [
  { value: "unknown", labelKey: "care.opt_unknown" },
  { value: "none", labelKey: "care.opt_none" },
  { value: "fistula_left", labelKey: "care.opt_fistula_left" },
  { value: "fistula_right", labelKey: "care.opt_fistula_right" },
  { value: "graft_left", labelKey: "care.opt_graft_left" },
  { value: "graft_right", labelKey: "care.opt_graft_right" },
  { value: "catheter", labelKey: "care.opt_catheter" },
];

const CONDITIONS: Option[] = [
  { value: "dialysis", labelKey: "care.cond_dialysis" },
  { value: "diabetes_insulin", labelKey: "care.cond_diabetes_insulin" },
  { value: "diabetes_oral", labelKey: "care.cond_diabetes_oral" },
  { value: "hypertension", labelKey: "care.cond_hypertension" },
];

const UNITS: { value: GlucoseUnit; label: string }[] = [
  { value: "g_l", label: "g/L" },
  { value: "mg_dl", label: "mg/dL" },
  { value: "mmol_l", label: "mmol/L" },
];

export function ClinicalFileForm({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ClinicalProfile | null;
}) {
  const router = useRouter();
  const unitInitial = profile?.glucoseDisplayUnit ?? "g_l";

  const [conditions, setConditions] = useState<string[]>(profile?.conditions ?? []);
  const [days, setDays] = useState<number[]>(profile?.dialysisDays ?? []);
  const [startTime, setStartTime] = useState(profile?.dialysisStartTime ?? "");
  const [duration, setDuration] = useState(
    profile?.dialysisDurationMinutes != null ? String(profile.dialysisDurationMinutes) : "240",
  );
  const [recoveryHours, setRecoveryHours] = useState(String(profile?.postSessionRecoveryHours ?? 24));
  const [bufferHours, setBufferHours] = useState(String(profile?.preSessionBufferHours ?? 4));
  const [access, setAccess] = useState<string>(profile?.vascularAccess ?? "unknown");

  const [weightBearing, setWeightBearing] = useState<string>(profile?.weightBearing ?? "unknown");
  const [wbSource, setWbSource] = useState(profile?.weightBearingSource ?? "");
  const [wbDate, setWbDate] = useState(profile?.weightBearingDatedOn ?? "");

  const [bpClearance, setBpClearance] = useState<string>(profile?.bpClearance ?? "unknown");
  const [bpSys, setBpSys] = useState(
    profile?.bpSkipAboveSystolic != null ? String(profile.bpSkipAboveSystolic) : "",
  );
  const [bpDia, setBpDia] = useState(
    profile?.bpSkipAboveDiastolic != null ? String(profile.bpSkipAboveDiastolic) : "",
  );
  const [bpBy, setBpBy] = useState(profile?.bpClearedBy ?? "");
  const [bpDate, setBpDate] = useState(profile?.bpClearedOn ?? "");

  const [unit, setUnit] = useState<GlucoseUnit>(unitInitial);
  const [floor, setFloor] = useState(
    profile?.glucoseFloorMgdl != null ? String(fromMgdl(profile.glucoseFloorMgdl, unitInitial)) : "",
  );
  const [ceiling, setCeiling] = useState(
    profile?.glucoseCeilingMgdl != null
      ? String(fromMgdl(profile.glucoseCeilingMgdl, unitInitial))
      : "",
  );
  const [glucoseBy, setGlucoseBy] = useState(profile?.glucoseSetBy ?? "");
  const [glucoseDate, setGlucoseDate] = useState(profile?.glucoseSetOn ?? "");

  const [notes, setNotes] = useState(profile?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const intOrNull = (value: string): number | null => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveClinicalFile({
        conditions,
        dialysisDays: days,
        dialysisStartTime: startTime || null,
        dialysisDurationMinutes: intOrNull(duration),
        postSessionRecoveryHours: intOrNull(recoveryHours) ?? 24,
        preSessionBufferHours: intOrNull(bufferHours) ?? 4,
        vascularAccess: access,
        weightBearing,
        weightBearingSource: wbSource || null,
        weightBearingDatedOn: wbDate || null,
        bpClearance,
        bpSkipAboveSystolic: intOrNull(bpSys),
        bpSkipAboveDiastolic: intOrNull(bpDia),
        bpClearedBy: bpBy || null,
        bpClearedOn: bpDate || null,
        glucoseFloor: parseDecimal(floor),
        glucoseCeiling: parseDecimal(ceiling),
        glucoseUnit: unit,
        glucoseSetBy: glucoseBy || null,
        glucoseSetOn: glucoseDate || null,
        notes: notes || null,
      });
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
        router.push("/care");
      }
    });
  };

  const showDialysis = conditions.includes("dialysis");

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-card border border-white/10 bg-white/[0.03] p-4 text-sm text-ink/90">
        {t(locale, "care.file_intro")}
      </p>

      <Field label={t(locale, "care.file_conditions")}>
        <ChipRow
          options={CONDITIONS}
          locale={locale}
          selected={conditions}
          onToggle={(value) => setConditions(toggle(conditions, value))}
        />
      </Field>

      {showDialysis && (
        <>
          <Field label={t(locale, "care.file_dialysis_days")}>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <Chip
                  key={day}
                  active={days.includes(day)}
                  onClick={() => setDays(toggle(days, day))}
                >
                  {t(locale, `care.dow_${day}` as StringKey)}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t(locale, "care.file_start_time")}>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label={t(locale, "care.file_duration")}>
              <Input
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label={t(locale, "care.file_recovery_hours")}>
              <Input
                inputMode="numeric"
                value={recoveryHours}
                onChange={(e) => setRecoveryHours(e.target.value)}
              />
            </Field>
            <Field label={t(locale, "care.file_buffer_hours")}>
              <Input
                inputMode="numeric"
                value={bufferHours}
                onChange={(e) => setBufferHours(e.target.value)}
              />
            </Field>
          </div>

          <Field label={t(locale, "care.file_access")}>
            <Select locale={locale} options={ACCESS} value={access} onChange={setAccess} />
          </Field>
        </>
      )}

      <Field label={t(locale, "care.file_weight_bearing")} hint={t(locale, "care.need_weight_bearing")}>
        <Select
          locale={locale}
          options={WEIGHT_BEARING}
          value={weightBearing}
          onChange={setWeightBearing}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={wbSource}
            onChange={(e) => setWbSource(e.target.value)}
            placeholder={t(locale, "care.file_set_by")}
          />
          <Input type="date" value={wbDate} onChange={(e) => setWbDate(e.target.value)} />
        </div>
      </Field>

      <Field label={t(locale, "care.file_bp_clearance")} hint={t(locale, "care.need_bp_clearance")}>
        <Select
          locale={locale}
          options={BP_CLEARANCE}
          value={bpClearance}
          onChange={setBpClearance}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{t(locale, "care.file_bp_skip")}</span>
          <Input
            inputMode="numeric"
            value={bpSys}
            onChange={(e) => setBpSys(e.target.value)}
            placeholder="160"
            className="max-w-20"
          />
          <span className="text-muted">/</span>
          <Input
            inputMode="numeric"
            value={bpDia}
            onChange={(e) => setBpDia(e.target.value)}
            placeholder="100"
            className="max-w-20"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={bpBy}
            onChange={(e) => setBpBy(e.target.value)}
            placeholder={t(locale, "care.file_set_by")}
          />
          <Input type="date" value={bpDate} onChange={(e) => setBpDate(e.target.value)} />
        </div>
      </Field>

      {(conditions.includes("diabetes_insulin") || conditions.includes("diabetes_oral")) && (
        <Field label={t(locale, "care.file_glucose_range")} hint={t(locale, "care.need_glucose_range")}>
          <div className="flex items-center gap-2">
            <DecimalInput value={floor} onValueChange={setFloor} placeholder="1.00" className="max-w-24" />
            <span className="text-muted">–</span>
            <DecimalInput
              value={ceiling}
              onValueChange={setCeiling}
              placeholder="2.50"
              className="max-w-24"
            />
            <div className="flex gap-1">
              {UNITS.map((option) => (
                <Chip
                  key={option.value}
                  active={unit === option.value}
                  onClick={() => setUnit(option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={glucoseBy}
              onChange={(e) => setGlucoseBy(e.target.value)}
              placeholder={t(locale, "care.file_set_by")}
            />
            <Input
              type="date"
              value={glucoseDate}
              onChange={(e) => setGlucoseDate(e.target.value)}
            />
          </div>
        </Field>
      )}

      <Field label={t(locale, "care.file_notes")}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/15 bg-transparent p-3 text-base outline-none focus:border-accent"
        />
      </Field>

      {error && <p className="text-sm font-bold text-red-400">{error}</p>}
      {saved && <p className="text-sm font-bold text-accent">{t(locale, "care.file_saved")}</p>}

      <Button onClick={submit} disabled={isPending}>
        <Save className="h-5 w-5" />
        {t(locale, "care.file_save")}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold">{label}</label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function Chip({
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
        "rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
        active ? "border-accent bg-accent/15 text-accent" : "border-white/15 hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

function ChipRow({
  options,
  locale,
  selected,
  onToggle,
}: {
  options: Option[];
  locale: Locale;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          active={selected.includes(option.value)}
          onClick={() => onToggle(option.value)}
        >
          {t(locale, option.labelKey)}
        </Chip>
      ))}
    </div>
  );
}

/**
 * A native <select>. Deliberately not a custom dropdown: this form is filled in
 * next to a doctor's letter, sometimes by somebody else's hands on somebody
 * else's phone, and the platform control is the one that always works.
 */
function Select({
  locale,
  options,
  value,
  onChange,
}: {
  locale: Locale;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-white/15 bg-surface px-3 text-base outline-none focus:border-accent"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-surface">
          {t(locale, option.labelKey)}
        </option>
      ))}
    </select>
  );
}
