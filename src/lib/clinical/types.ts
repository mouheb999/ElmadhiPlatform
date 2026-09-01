/**
 * The care domain, in the app's own vocabulary.
 *
 * Every one of these unions has an `"unknown"` member, and it is always the
 * DEFAULT rather than a rare edge. That is the whole design: this module
 * describes a patient whose program is defined by four clinicians' answers,
 * and the interesting state — the one the product spends most of its life in —
 * is "we do not have that answer yet". A type where the unknown case has to be
 * handled at every branch is the cheapest way to stop the app quietly assuming
 * a permissive default it was never given.
 *
 * Client-safe: no server imports, no `Date.now()` at module scope, so the
 * session screen and the server action can share one set of rules.
 */

export type Condition =
  | "dialysis"
  | "diabetes_insulin"
  | "diabetes_oral"
  | "hypertension";

/** ISO weekday: 1 = Monday … 7 = Sunday, matching clinical_profiles.dialysis_days. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The orthopedist's line. The only thing standing between the program and a
 * loaded leg movement, and the reason `"unknown"` and `"none"` behave
 * identically downstream: an answer nobody has given is not a smaller
 * restriction than an answer of "no".
 */
export type WeightBearing = "unknown" | "none" | "partial" | "full";

/**
 * The intensity ceiling, set by whoever manages his blood pressure. Note what
 * is missing: there is no "unrestricted". The most permissive value this
 * product will accept for a dialysis patient with hypertension is "moderate".
 */
export type BpClearance = "unknown" | "not_cleared" | "light_only" | "moderate";

/**
 * The access. Side matters because the restriction is limb-specific — no load
 * carried through it, no cuff on it, nothing resting on it — and a neck
 * catheter restricts no arm at all.
 */
export type VascularAccess =
  | "unknown"
  | "none"
  | "fistula_left"
  | "fistula_right"
  | "graft_left"
  | "graft_right"
  | "catheter";

/** What his meter and his doctor's note actually say. Storage is always mg/dL. */
export type GlucoseUnit = "g_l" | "mg_dl" | "mmol_l";

export type ClinicalProfile = {
  id: string;
  userId: string;
  conditions: Condition[];

  dialysisDays: Weekday[];
  /** "HH:MM" local (Africa/Tunis), or null when the unit's time isn't on file. */
  dialysisStartTime: string | null;
  dialysisDurationMinutes: number | null;
  postSessionRecoveryHours: number;
  preSessionBufferHours: number;
  vascularAccess: VascularAccess;

  weightBearing: WeightBearing;
  weightBearingSource: string | null;
  weightBearingDatedOn: string | null;

  bpClearance: BpClearance;
  bpSkipAboveSystolic: number | null;
  bpSkipAboveDiastolic: number | null;
  bpClearedBy: string | null;
  bpClearedOn: string | null;

  glucoseFloorMgdl: number | null;
  glucoseCeilingMgdl: number | null;
  glucoseDisplayUnit: GlucoseUnit;
  glucoseSetBy: string | null;
  glucoseSetOn: string | null;

  sessionMinMinutes: number;
  sessionMaxMinutes: number;
  restSecondsMin: number;
  effortCeiling: number;
  seatedOrSupportedOnly: boolean;

  notes: string | null;
};

/** The row shape as PostgREST hands it back, before `fromRow` renames it. */
export type ClinicalProfileRow = {
  id: string;
  user_id: string;
  conditions: string[] | null;
  dialysis_days: number[] | null;
  dialysis_start_time: string | null;
  dialysis_duration_minutes: number | null;
  post_session_recovery_hours: number | null;
  pre_session_buffer_hours: number | null;
  vascular_access: string | null;
  weight_bearing: string | null;
  weight_bearing_source: string | null;
  weight_bearing_dated_on: string | null;
  bp_clearance: string | null;
  bp_skip_above_systolic: number | null;
  bp_skip_above_diastolic: number | null;
  bp_cleared_by: string | null;
  bp_cleared_on: string | null;
  glucose_floor_mgdl: number | null;
  glucose_ceiling_mgdl: number | null;
  glucose_display_unit: string | null;
  glucose_set_by: string | null;
  glucose_set_on: string | null;
  session_min_minutes: number | null;
  session_max_minutes: number | null;
  rest_seconds_min: number | null;
  effort_ceiling: number | null;
  seated_or_supported_only: boolean | null;
  notes: string | null;
};

const CONDITIONS: readonly string[] = [
  "dialysis",
  "diabetes_insulin",
  "diabetes_oral",
  "hypertension",
];
const WEIGHT_BEARING: readonly string[] = ["unknown", "none", "partial", "full"];
const BP_CLEARANCE: readonly string[] = [
  "unknown",
  "not_cleared",
  "light_only",
  "moderate",
];
const ACCESS: readonly string[] = [
  "unknown",
  "none",
  "fistula_left",
  "fistula_right",
  "graft_left",
  "graft_right",
  "catheter",
];
const GLUCOSE_UNITS: readonly string[] = ["g_l", "mg_dl", "mmol_l"];

/**
 * Read a DB row into the domain type, coercing anything unrecognised to the
 * restrictive member rather than to the row's raw text.
 *
 * This is not defensive paranoia about a CHECK constraint that already holds.
 * It is what makes the type honest across a deploy: if migration 053 ever adds
 * a fifth `weight_bearing` value, an older running instance reads it as
 * `"unknown"` and closes the leg gate, instead of falling through every
 * `switch` in gates.ts and landing on whatever the last `else` happened to be.
 */
export function fromRow(row: ClinicalProfileRow): ClinicalProfile {
  const oneOf = <T extends string>(
    value: string | null,
    allowed: readonly string[],
    fallback: T,
  ): T => (value !== null && allowed.includes(value) ? (value as T) : fallback);

  return {
    id: row.id,
    userId: row.user_id,
    conditions: (row.conditions ?? []).filter((c): c is Condition =>
      CONDITIONS.includes(c),
    ),
    dialysisDays: (row.dialysis_days ?? []).filter((d): d is Weekday =>
      Number.isInteger(d) && d >= 1 && d <= 7,
    ),
    dialysisStartTime: row.dialysis_start_time
      ? row.dialysis_start_time.slice(0, 5)
      : null,
    dialysisDurationMinutes: row.dialysis_duration_minutes,
    postSessionRecoveryHours: row.post_session_recovery_hours ?? 24,
    preSessionBufferHours: row.pre_session_buffer_hours ?? 4,
    vascularAccess: oneOf<VascularAccess>(row.vascular_access, ACCESS, "unknown"),
    weightBearing: oneOf<WeightBearing>(row.weight_bearing, WEIGHT_BEARING, "unknown"),
    weightBearingSource: row.weight_bearing_source,
    weightBearingDatedOn: row.weight_bearing_dated_on,
    bpClearance: oneOf<BpClearance>(row.bp_clearance, BP_CLEARANCE, "unknown"),
    bpSkipAboveSystolic: row.bp_skip_above_systolic,
    bpSkipAboveDiastolic: row.bp_skip_above_diastolic,
    bpClearedBy: row.bp_cleared_by,
    bpClearedOn: row.bp_cleared_on,
    glucoseFloorMgdl: row.glucose_floor_mgdl,
    glucoseCeilingMgdl: row.glucose_ceiling_mgdl,
    glucoseDisplayUnit: oneOf<GlucoseUnit>(
      row.glucose_display_unit,
      GLUCOSE_UNITS,
      "g_l",
    ),
    glucoseSetBy: row.glucose_set_by,
    glucoseSetOn: row.glucose_set_on,
    sessionMinMinutes: row.session_min_minutes ?? 15,
    sessionMaxMinutes: row.session_max_minutes ?? 25,
    restSecondsMin: row.rest_seconds_min ?? 120,
    effortCeiling: row.effort_ceiling ?? 4,
    seatedOrSupportedOnly: row.seated_or_supported_only ?? true,
    notes: row.notes,
  };
}

export function hasCondition(
  profile: ClinicalProfile | null,
  condition: Condition,
): boolean {
  return profile?.conditions.includes(condition) ?? false;
}

/** True when insulin is in play, which is what makes the glucose protocol mandatory. */
export function onInsulin(profile: ClinicalProfile | null): boolean {
  return hasCondition(profile, "diabetes_insulin");
}

/**
 * Which arm the access is in, if any — the answer the exercise picker and the
 * blood-pressure prompt both need. A catheter is not in an arm, and "none" and
 * "unknown" are different: with no access recorded at all there is nothing to
 * protect, while `"unknown"` on a dialysis patient means we have not asked,
 * and the UI says so instead of silently protecting neither arm.
 */
export function accessArm(
  profile: ClinicalProfile | null,
): "left" | "right" | "none" | "unknown" {
  switch (profile?.vascularAccess) {
    case "fistula_left":
    case "graft_left":
      return "left";
    case "fistula_right":
    case "graft_right":
      return "right";
    case "catheter":
    case "none":
      return "none";
    default:
      return profile && hasCondition(profile, "dialysis") ? "unknown" : "none";
  }
}

/**
 * mg/dL out, whatever the meter shows. Tunisia reads glucose in g/L — 1.20 g/L
 * is 120 mg/dL — and a patient typing "1.2" into a field that means mg/dL is a
 * hypoglycaemia reading that never happened.
 */
export function toMgdl(value: number, unit: GlucoseUnit): number {
  switch (unit) {
    case "g_l":
      return Math.round(value * 100);
    case "mmol_l":
      return Math.round(value * 18.016);
    case "mg_dl":
      return Math.round(value);
  }
}

/** mg/dL back into the unit he reads, for display only. */
export function fromMgdl(mgdl: number, unit: GlucoseUnit): number {
  switch (unit) {
    case "g_l":
      return Math.round(mgdl) / 100;
    case "mmol_l":
      return Math.round((mgdl / 18.016) * 10) / 10;
    case "mg_dl":
      return Math.round(mgdl);
  }
}

/** How many decimals a unit is written to, so the input and the label agree. */
export function glucoseDecimals(unit: GlucoseUnit): number {
  return unit === "mg_dl" ? 0 : unit === "mmol_l" ? 1 : 2;
}
