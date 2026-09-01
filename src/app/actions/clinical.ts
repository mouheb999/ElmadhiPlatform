"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePaidUser } from "@/lib/subscription-server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { tunisDateKey } from "@/lib/dates";
import { judgeBloodPressure, judgeGlucose } from "@/lib/clinical/gates";
import {
  fromRow,
  toMgdl,
  type ClinicalProfileRow,
  type GlucoseUnit,
} from "@/lib/clinical/types";

/**
 * Writes for the care layer.
 *
 * Two things are true of every action here and are worth stating once rather
 * than at each function:
 *
 * 1. **The verdict is computed on the server and stored on the row.** The
 *    browser sends a measurement; it never sends whether that measurement was
 *    in range. A client that could name its own outcome could tap past a
 *    hypoglycaemia block by sending `"in_range"`, and that is the one bug in
 *    this file that would actually hurt somebody.
 *
 * 2. **Nothing here decides a threshold.** `judgeGlucose` and
 *    `judgeBloodPressure` return `"unjudged"` when no clinician has set one,
 *    and `"unjudged"` is what gets stored. The app is content to record a
 *    number it is not qualified to interpret.
 */

async function activeProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("clinical_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data ? fromRow(data as ClinicalProfileRow) : null;
}

/** Every screen that shows any part of the care state. */
function revalidateCare() {
  revalidatePath("/care");
  revalidatePath("/dashboard");
  revalidatePath("/workout");
}

// ============================================================
// Readings
// ============================================================

export type GlucoseInput = {
  /** As typed, in whatever unit the picker was showing. */
  value: number;
  unit: GlucoseUnit;
  timing: "pre_session" | "post_session" | "spot";
  sessionId?: string | null;
  actionTaken?: string | null;
};

/**
 * "Check before, check after, have fast carbs on hand, and skip the session
 * outside a range his diabetologist defines."
 *
 * This action is the first two and the record of the third. The fourth — the
 * skip — is enforced by `sessionReadiness` reading the row this writes.
 */
export async function logGlucose(input: GlucoseInput): Promise<ActionResult<{ outcome: string }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (!Number.isFinite(input.value) || input.value <= 0) {
    return fail("Enter the reading from your meter.");
  }
  const mgdl = toMgdl(input.value, input.unit);
  // The widest range any meter reports. A 1.2 typed into a mg/dL field lands
  // here rather than in the database as a hypo that never happened.
  if (mgdl < 20 || mgdl > 900) {
    return fail("That reading looks out of range — check the unit you picked.");
  }

  const profile = await activeProfile(supabase, user.id);
  const verdict = judgeGlucose(profile, mgdl);

  const { error } = await supabase.from("clinical_readings").insert({
    user_id: user.id,
    session_id: input.sessionId ?? null,
    kind: "glucose",
    timing: input.timing,
    glucose_mgdl: mgdl,
    outcome: verdict.outcome,
    action_taken: input.actionTaken ?? null,
  });
  if (error) return fail(error.message);

  revalidateCare();
  return ok({ outcome: verdict.outcome });
}

export type BloodPressureInput = {
  systolic: number;
  diastolic: number;
  pulseBpm?: number | null;
  timing: "pre_session" | "post_session" | "spot";
  sessionId?: string | null;
};

export async function logBloodPressure(
  input: BloodPressureInput,
): Promise<ActionResult<{ outcome: string }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const { systolic, diastolic } = input;
  if (!Number.isInteger(systolic) || !Number.isInteger(diastolic)) {
    return fail("Enter both numbers from the monitor.");
  }
  if (systolic < 50 || systolic > 300 || diastolic < 20 || diastolic > 200) {
    return fail("That reading looks out of range — check the numbers.");
  }
  if (diastolic >= systolic) {
    return fail("The top number should be the larger one.");
  }

  const profile = await activeProfile(supabase, user.id);
  const verdict = judgeBloodPressure(profile, systolic, diastolic);

  const { error } = await supabase.from("clinical_readings").insert({
    user_id: user.id,
    session_id: input.sessionId ?? null,
    kind: "blood_pressure",
    timing: input.timing,
    systolic,
    diastolic,
    pulse_bpm: input.pulseBpm ?? null,
    outcome: verdict.outcome,
  });
  if (error) return fail(error.message);

  revalidateCare();
  return ok({ outcome: verdict.outcome });
}

// ============================================================
// Nutrition: logging against the dietitian's numbers, not ours
// ============================================================

/** One drink. The day's total is a SUM, so a mistyped glass is deletable. */
export async function logFluid(ml: number, label?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (!Number.isInteger(ml) || ml < 1 || ml > 3000) {
    return fail("Enter how much you drank, in millilitres.");
  }

  const { error } = await supabase.from("fluid_logs").insert({
    user_id: user.id,
    log_date: tunisDateKey(),
    ml,
    label: label?.trim() || null,
  });
  if (error) return fail(error.message);

  revalidateCare();
  revalidatePath("/diet");
  return ok(undefined);
}

export async function deleteFluidLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  // `.eq("user_id")` on top of RLS: the policy already scopes this, and the
  // filter makes the intent legible at the call site rather than depending on
  // a reader knowing migration 052 by heart.
  const { error } = await supabase.from("fluid_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidateCare();
  revalidatePath("/diet");
  return ok(undefined);
}

/**
 * Did today match the paper? Three states, once a day.
 *
 * There is no score and no derived percentage here on purpose: the app did not
 * write his meal plan and cannot mark his homework against it. It records what
 * he says and shows it back to whoever reads it with him.
 */
export async function logRenalAdherence(
  adherence: "on_plan" | "partial" | "off_plan",
  note?: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const { error } = await supabase.from("renal_plan_adherence").upsert(
    {
      user_id: user.id,
      log_date: tunisDateKey(),
      adherence,
      note: note?.trim() || null,
    },
    { onConflict: "user_id,log_date" },
  );
  if (error) return fail(error.message);

  revalidateCare();
  revalidatePath("/diet");
  return ok(undefined);
}

// ============================================================
// The progression inputs
// ============================================================

export type SessionWellnessInput = {
  sessionId: string;
  perceivedEffort: number | null;
  stoppedEarly: boolean;
  stopReason?: string | null;
  felt: "good" | "ok" | "rough" | null;
};

/** How the session went — asked at the end of it, and half of what progresses him. */
export async function saveSessionWellness(
  input: SessionWellnessInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (
    input.perceivedEffort !== null &&
    (!Number.isInteger(input.perceivedEffort) ||
      input.perceivedEffort < 1 ||
      input.perceivedEffort > 10)
  ) {
    return fail("Effort is a number from 1 to 10.");
  }

  const { error } = await supabase.from("session_wellness").upsert(
    {
      session_id: input.sessionId,
      user_id: user.id,
      perceived_effort: input.perceivedEffort,
      stopped_early: input.stoppedEarly,
      stop_reason: input.stopReason?.trim() || null,
      felt: input.felt,
    },
    { onConflict: "session_id" },
  );
  if (error) return fail(error.message);

  revalidateCare();
  return ok(undefined);
}

/**
 * The other half: how the next day went. Written against the session it
 * follows, because "recovered by the next day" is a fact about that session
 * and not about the calendar.
 */
export async function saveRecoveryAnswer(
  sessionId: string,
  recovery: "recovered" | "tired" | "wiped_out",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const { error } = await supabase
    .from("session_wellness")
    .update({ next_day_recovery: recovery })
    .eq("session_id", sessionId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidateCare();
  return ok(undefined);
}

export type SymptomInput = {
  symptom: string;
  severity: "mild" | "moderate" | "severe";
  sessionId?: string | null;
  note?: string | null;
};

/**
 * A symptom flag. The vocabulary is closed in the database (migration 052) and
 * mirrored here, because a flag the progression rule does not recognise is a
 * flag that silently does nothing.
 */
export const SYMPTOMS = [
  "cramps",
  "dizziness",
  "breathlessness",
  "chest_discomfort",
  "palpitations",
  "swelling",
  "access_site_pain",
  "nausea",
  "hypo_symptoms",
  "unusual_fatigue",
  "joint_pain",
  "headache",
] as const;

export async function flagSymptom(input: SymptomInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  if (!(SYMPTOMS as readonly string[]).includes(input.symptom)) {
    return fail("Pick one of the listed symptoms.");
  }

  const { error } = await supabase.from("symptom_flags").insert({
    user_id: user.id,
    session_id: input.sessionId ?? null,
    flagged_on: tunisDateKey(),
    symptom: input.symptom,
    severity: input.severity,
    note: input.note?.trim() || null,
  });
  if (error) return fail(error.message);

  revalidateCare();
  return ok(undefined);
}

// ============================================================
// The clinical file itself
// ============================================================

export type ClinicalFileInput = {
  conditions: string[];
  dialysisDays: number[];
  dialysisStartTime: string | null;
  dialysisDurationMinutes: number | null;
  postSessionRecoveryHours: number;
  preSessionBufferHours: number;
  vascularAccess: string;

  weightBearing: string;
  weightBearingSource: string | null;
  weightBearingDatedOn: string | null;

  bpClearance: string;
  bpSkipAboveSystolic: number | null;
  bpSkipAboveDiastolic: number | null;
  bpClearedBy: string | null;
  bpClearedOn: string | null;

  /** In `glucoseUnit`, converted here. Both bounds or neither. */
  glucoseFloor: number | null;
  glucoseCeiling: number | null;
  glucoseUnit: GlucoseUnit;
  glucoseSetBy: string | null;
  glucoseSetOn: string | null;

  notes: string | null;
};

/**
 * The fields whose value changes what the app will let him do. Changing one of
 * these supersedes the profile instead of editing it, so the sessions logged
 * under the old answer stay explainable: "he trained upper body only in
 * September" has a row behind it that says why.
 *
 * Everything else — a dietitian's name, a note, the recovery-hours number the
 * coach is still tuning — is edited in place. Versioning those too would turn
 * the history into noise and make the real clearance changes hard to find.
 */
const GATE_FIELDS = [
  "conditions",
  "dialysis_days",
  "dialysis_start_time",
  "vascular_access",
  "weight_bearing",
  "bp_clearance",
  "bp_skip_above_systolic",
  "bp_skip_above_diastolic",
  "glucose_floor_mgdl",
  "glucose_ceiling_mgdl",
] as const;

function sameGates(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  return GATE_FIELDS.every((field) => {
    const a = current[field];
    const b = next[field];
    if (Array.isArray(a) || Array.isArray(b)) {
      const aa = (a ?? []) as unknown[];
      const bb = (b ?? []) as unknown[];
      return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }
    return (a ?? null) === (b ?? null);
  });
}

/**
 * Save the clinical file — the four clinicians' answers, as transcribed by
 * whoever is holding the letters.
 *
 * Note what this does NOT validate: whether a glucose window is medically
 * sensible, or whether "moderate" is the right clearance for him. Those are
 * not the app's calls. What it validates is that a transcription error cannot
 * become a gate — a floor above its ceiling, a diastolic above its systolic, a
 * clearance value the gates would not recognise.
 */
export async function saveClinicalFile(input: ClinicalFileInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const oneOf = (value: string, allowed: string[]) => allowed.includes(value);
  if (!oneOf(input.weightBearing, ["unknown", "none", "partial", "full"])) {
    return fail("Pick a weight-bearing status.");
  }
  if (!oneOf(input.bpClearance, ["unknown", "not_cleared", "light_only", "moderate"])) {
    return fail("Pick a blood-pressure clearance.");
  }
  if (
    !oneOf(input.vascularAccess, [
      "unknown",
      "none",
      "fistula_left",
      "fistula_right",
      "graft_left",
      "graft_right",
      "catheter",
    ])
  ) {
    return fail("Pick an access type.");
  }
  if (input.dialysisDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    return fail("Dialysis days are weekdays.");
  }
  if (input.dialysisStartTime && !/^\d{2}:\d{2}$/.test(input.dialysisStartTime)) {
    return fail("Session time should look like 07:30.");
  }

  // Both bounds or neither: half a window would either refuse every session or
  // pass a reading it should have caught.
  if ((input.glucoseFloor === null) !== (input.glucoseCeiling === null)) {
    return fail("Set both ends of the glucose range, or neither.");
  }
  const floor = input.glucoseFloor === null ? null : toMgdl(input.glucoseFloor, input.glucoseUnit);
  const ceiling =
    input.glucoseCeiling === null ? null : toMgdl(input.glucoseCeiling, input.glucoseUnit);
  if (floor !== null && ceiling !== null && floor >= ceiling) {
    return fail("The bottom of the range has to be below the top.");
  }

  const next = {
    user_id: user.id,
    conditions: input.conditions,
    dialysis_days: [...input.dialysisDays].sort((a, b) => a - b),
    dialysis_start_time: input.dialysisStartTime,
    dialysis_duration_minutes: input.dialysisDurationMinutes,
    post_session_recovery_hours: input.postSessionRecoveryHours,
    pre_session_buffer_hours: input.preSessionBufferHours,
    vascular_access: input.vascularAccess,
    weight_bearing: input.weightBearing,
    weight_bearing_source: input.weightBearingSource?.trim() || null,
    weight_bearing_dated_on: input.weightBearingDatedOn,
    bp_clearance: input.bpClearance,
    bp_skip_above_systolic: input.bpSkipAboveSystolic,
    bp_skip_above_diastolic: input.bpSkipAboveDiastolic,
    bp_cleared_by: input.bpClearedBy?.trim() || null,
    bp_cleared_on: input.bpClearedOn,
    glucose_floor_mgdl: floor,
    glucose_ceiling_mgdl: ceiling,
    glucose_display_unit: input.glucoseUnit,
    glucose_set_by: input.glucoseSetBy?.trim() || null,
    glucose_set_on: input.glucoseSetOn,
    notes: input.notes?.trim() || null,
  };

  const { data: current } = await supabase
    .from("clinical_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!current) {
    const { error } = await supabase.from("clinical_profiles").insert(next);
    if (error) return fail(error.message);
    revalidateCare();
    return ok(undefined);
  }

  if (sameGates(current as unknown as Record<string, unknown>, next)) {
    const { error } = await supabase
      .from("clinical_profiles")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (error) return fail(error.message);
    revalidateCare();
    return ok(undefined);
  }

  // Supersede. The unique partial index allows one active row per user, so the
  // old one is retired first — a failure between the two leaves him with no
  // active profile, which the gates read as "everything unknown" and therefore
  // as the safe state rather than the permissive one.
  const { error: retireError } = await supabase
    .from("clinical_profiles")
    .update({ is_active: false })
    .eq("id", current.id);
  if (retireError) return fail(retireError.message);

  const { error } = await supabase
    .from("clinical_profiles")
    .insert({ ...next, version: (current.version ?? 1) + 1 });
  if (error) return fail(error.message);

  revalidateCare();
  return ok(undefined);
}

export type RenalPlanInput = {
  dietitianName: string | null;
  issuedOn: string | null;
  documentPath: string | null;
  calories: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  phosphorusMg: number | null;
  fluidMlPerDay: number | null;
  meals: { time: string | null; label_en: string | null; label_ar: string | null; portions: string | null }[];
  notes: string | null;
};

/**
 * Store the renal dietitian's plan, as written.
 *
 * The single most important thing about this function is what it is missing: a
 * calculation. Nothing derives calories from a body weight, nothing splits
 * protein across meals, nothing checks the numbers against the app's own
 * macro engine. "This is the one part that isn't yours to design at all" —
 * so it is transcription and storage, and the uploaded document at
 * `documentPath` outranks the transcription if they ever disagree.
 */
export async function saveRenalPlan(input: RenalPlanInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

  const { error: retireError } = await supabase
    .from("renal_diet_plans")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (retireError) return fail(retireError.message);

  const { error } = await supabase.from("renal_diet_plans").insert({
    user_id: user.id,
    dietitian_name: input.dietitianName?.trim() || null,
    issued_on: input.issuedOn,
    document_path: input.documentPath,
    calories: input.calories,
    protein_g: input.proteinG,
    sodium_mg: input.sodiumMg,
    potassium_mg: input.potassiumMg,
    phosphorus_mg: input.phosphorusMg,
    fluid_ml_per_day: input.fluidMlPerDay,
    meals: input.meals,
    notes: input.notes?.trim() || null,
  });
  if (error) return fail(error.message);

  revalidateCare();
  revalidatePath("/diet");
  return ok(undefined);
}
