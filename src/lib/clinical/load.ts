/**
 * One read of the care state, shared by every screen that needs it.
 *
 * /care renders all of it, the dashboard renders the headline, and the session
 * screen renders the gate. Three screens asking three different subsets would
 * be three chances for them to disagree about whether he may train right now —
 * so they ask the same function and differ only in what they show.
 *
 * Takes the Supabase client rather than making one, matching `lib/support.ts`:
 * this file is imported by server components and by server actions, and both
 * already have a client in hand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { tunisDateKey, tunisWeekStartUtc } from "@/lib/dates";
import { canTrainAt, dayPlan, weekPlan, type DayPlan } from "./schedule";
import {
  accessRestriction,
  outstandingClearances,
  sessionReadiness,
  sessionShape,
  type AccessRestriction,
  type Readiness,
  type SessionShape,
} from "./gates";
import { nextProgression, type ProgressionDecision, type SessionRecord } from "./progression";
import { fromRow, type ClinicalProfile, type ClinicalProfileRow } from "./types";

type Client = SupabaseClient<Database>;

export type RenalPlanMeal = {
  time: string | null;
  labelEn: string | null;
  labelAr: string | null;
  portions: string | null;
};

export type RenalPlan = {
  id: string;
  dietitianName: string | null;
  issuedOn: string | null;
  documentPath: string | null;
  calories: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  phosphorusMg: number | null;
  fluidMlPerDay: number | null;
  meals: RenalPlanMeal[];
  notes: string | null;
};

export type CareState = {
  profile: ClinicalProfile | null;
  /** Today, typed. */
  today: DayPlan;
  /** Monday-to-Sunday for the week strip. */
  week: DayPlan[];
  /** May a session start at `now`, on the day-type rule alone. */
  timing: ReturnType<typeof canTrainAt>;
  /** The gates, given what has been measured today. */
  readiness: Readiness;
  shape: SessionShape;
  access: AccessRestriction;
  /** Today's pre-session readings, already judged when they were written. */
  todayGlucoseMgdl: number | null;
  todayBp: { systolic: number; diastolic: number } | null;
  /** What each clinician still owes, derived from the gates. */
  outstanding: ReturnType<typeof outstandingClearances>;
  renalPlan: RenalPlan | null;
  fluidTodayMl: number;
  adherenceToday: "on_plan" | "partial" | "off_plan" | null;
  progression: ProgressionDecision;
};

function parseMeals(raw: unknown): RenalPlanMeal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const meal = (entry ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
    return {
      time: str(meal.time),
      labelEn: str(meal.label_en),
      labelAr: str(meal.label_ar),
      portions: str(meal.portions),
    };
  });
}

/**
 * @param now injected so the tests and the session screen can agree on "today"
 *            without either of them reading the clock twice.
 */
export async function loadCareState(
  supabase: Client,
  userId: string,
  now: Date = new Date(),
): Promise<CareState> {
  const todayKey = tunisDateKey(now);
  const mondayKey = tunisDateKey(tunisWeekStartUtc(now));
  const dayStartIso = new Date(`${todayKey}T00:00:00Z`).toISOString();

  // One round. Nothing here depends on anything else here — the clinical
  // profile shapes how the results are *judged*, not which rows are fetched.
  const [
    { data: profileRow },
    { data: readingRows },
    { data: planRow },
    { data: fluidRows },
    { data: adherenceRow },
    { data: wellnessRows },
    { data: flagRows },
  ] = await Promise.all([
    supabase
      .from("clinical_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("clinical_readings")
      .select("kind, timing, glucose_mgdl, systolic, diastolic, taken_at")
      .eq("user_id", userId)
      .gte("taken_at", dayStartIso)
      .order("taken_at", { ascending: false }),
    supabase
      .from("renal_diet_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("fluid_logs").select("ml").eq("user_id", userId).eq("log_date", todayKey),
    supabase
      .from("renal_plan_adherence")
      .select("adherence")
      .eq("user_id", userId)
      .eq("log_date", todayKey)
      .maybeSingle(),
    supabase
      .from("session_wellness")
      .select("session_id, felt, stopped_early, perceived_effort, next_day_recovery, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("symptom_flags")
      .select("session_id, symptom, severity, flagged_on")
      .eq("user_id", userId)
      .order("flagged_on", { ascending: false })
      .limit(40),
  ]);

  const profile = profileRow ? fromRow(profileRow as ClinicalProfileRow) : null;

  // Only PRE-session readings gate a session. A post-session glucose is the
  // other half of the protocol and belongs in the log, not in the door.
  const readings = readingRows ?? [];
  const preGlucose = readings.find((r) => r.kind === "glucose" && r.timing === "pre_session");
  const preBp = readings.find((r) => r.kind === "blood_pressure" && r.timing === "pre_session");
  const todayGlucoseMgdl = preGlucose?.glucose_mgdl ?? null;
  const todayBp =
    preBp?.systolic != null && preBp?.diastolic != null
      ? { systolic: preBp.systolic, diastolic: preBp.diastolic }
      : null;

  // Symptoms attach to the session they were flagged during; the loose ones
  // (a rough dialysis morning) still count towards the red-flag scan, so they
  // ride along on the most recent session rather than being dropped.
  const flags = flagRows ?? [];
  const sessions: SessionRecord[] = (wellnessRows ?? []).map((row, index) => ({
    dateKey: (row.created_at ?? "").slice(0, 10),
    felt: (row.felt as SessionRecord["felt"]) ?? null,
    stoppedEarly: row.stopped_early ?? false,
    perceivedEffort: row.perceived_effort,
    nextDayRecovery: (row.next_day_recovery as SessionRecord["nextDayRecovery"]) ?? null,
    symptoms: flags
      .filter((f) =>
        f.session_id
          ? f.session_id === row.session_id
          : index === 0 && f.flagged_on >= (row.created_at ?? "").slice(0, 10),
      )
      .map((f) => ({
        symptom: f.symptom,
        severity: f.severity as SessionRecord["symptoms"][number]["severity"],
      })),
  }));

  const shape = sessionShape(profile);
  const plan = planRow
    ? {
        id: planRow.id,
        dietitianName: planRow.dietitian_name,
        issuedOn: planRow.issued_on,
        documentPath: planRow.document_path,
        calories: planRow.calories,
        proteinG: planRow.protein_g,
        sodiumMg: planRow.sodium_mg,
        potassiumMg: planRow.potassium_mg,
        phosphorusMg: planRow.phosphorus_mg,
        fluidMlPerDay: planRow.fluid_ml_per_day,
        meals: parseMeals(planRow.meals),
        notes: planRow.notes,
      }
    : null;

  return {
    profile,
    today: dayPlan(profile, todayKey),
    week: weekPlan(profile, mondayKey),
    timing: canTrainAt(profile, now),
    readiness: sessionReadiness(profile, { glucoseMgdl: todayGlucoseMgdl, bp: todayBp }),
    shape,
    access: accessRestriction(profile),
    todayGlucoseMgdl,
    todayBp,
    outstanding: outstandingClearances(profile),
    renalPlan: plan,
    fluidTodayMl: (fluidRows ?? []).reduce((sum, row) => sum + (row.ml ?? 0), 0),
    adherenceToday: (adherenceRow?.adherence as CareState["adherenceToday"]) ?? null,
    // "At cap" decides whether the next step adds minutes or an exercise. The
    // session length actually in use is the shape's max once he has worked up
    // to it; before any history exists this is false and the ladder starts at
    // minutes, which is the gentler of the two.
    progression: nextProgression(sessions, shape.maxMinutes <= shape.minMinutes),
  };
}

/**
 * Does the care layer apply to this account at all?
 *
 * Everything in this module is inert for the 99% of users with no clinical
 * profile: no nav item, no dashboard card, no gate. One check, one place.
 */
export function careApplies(state: CareState | null): boolean {
  return state?.profile !== null && state?.profile !== undefined;
}
