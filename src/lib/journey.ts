import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { Goal } from "@/lib/algorithms/diet-strategy";
import type { ActivityLevel } from "@/lib/algorithms/macros";
import { isComplete, parseFunnelAnswers } from "@/lib/funnel/answers";
import {
  calculateFitnessPlan,
  type FitnessPlan,
  type FitnessPlanInput,
} from "@/lib/funnel/fitness-plan";

/**
 * The plan a member was shown before they signed up, read back inside the app.
 *
 * /start ends on a timeline: today, four weeks, eight, twelve, each with a date
 * and a weight. It is the most persuasive screen in the product, and until now
 * it was shown exactly once — the member created an account and never saw it
 * again. The thing they signed up for was not anywhere in the thing they
 * signed up to.
 *
 * This rebuilds it from what the account already holds, anchored to the day
 * the member started rather than to today, so the stops stay put and the
 * screen can say which of them have been passed.
 *
 * Two sources, in order:
 *
 *   1. The active diet profile — the questionnaire inside the app. It is the
 *      plan they are actually eating to, and it carries a body-fat figure the
 *      funnel never asks for.
 *   2. The answers from /start, kept on the profile at sign-up. Enough for the
 *      same timeline, for a member who has not finished the questionnaire.
 *
 * Returns null when neither is complete enough, or when the engine says the
 * numbers do not support a plan. Nothing is shown rather than something made
 * up — the same rule the reveal follows.
 */
export type Journey = {
  plan: FitnessPlan;
  /** When the plan started, epoch ms. Stop dates are offsets from this. */
  startAt: number;
  /** Whole weeks since then, 0 on the first day. Not capped. */
  elapsedWeeks: number;
  /** Days since then, 0 on the first day. */
  elapsedDays: number;
  startKg: number;
  targetKg: number;
};

const WEEK_MS = 7 * 86_400_000;

function ageFromBirthDate(birthDate: string | null, now: number): number | null {
  if (!birthDate) return null;
  const born = Date.parse(birthDate);
  if (Number.isNaN(born)) return null;
  const years = Math.floor((now - born) / (365.25 * 86_400_000));
  return years > 0 && years < 120 ? years : null;
}

export async function loadJourney(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: number = Date.now(),
): Promise<Journey | null> {
  const [{ data: profile }, { data: diet }] = await Promise.all([
    supabase.from("profiles").select("funnel_answers, created_at").eq("id", userId).maybeSingle(),
    supabase
      .from("diet_profiles")
      .select(
        "goal, gender, birth_date, height_cm, weight_kg, target_weight_kg, activity_level, training_days, body_fat_percent, created_at",
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  let input: FitnessPlanInput | null = null;
  let startedAt: string | null = null;

  const dietAge = ageFromBirthDate(diet?.birth_date ?? null, now);
  if (
    diet &&
    diet.goal &&
    (diet.gender === "male" || diet.gender === "female") &&
    dietAge !== null &&
    diet.height_cm &&
    diet.weight_kg &&
    diet.target_weight_kg &&
    diet.activity_level
  ) {
    input = {
      goal: diet.goal as Goal,
      gender: diet.gender,
      age: dietAge,
      heightCm: diet.height_cm,
      weightKg: diet.weight_kg,
      targetWeightKg: diet.target_weight_kg,
      activityLevel: diet.activity_level as ActivityLevel,
      trainingDays: diet.training_days,
      bodyFatPercent: diet.body_fat_percent,
    };
    startedAt = diet.created_at;
  } else if (profile?.funnel_answers) {
    // Re-parsed rather than trusted: it was written from a cookie at sign-up.
    const answers = parseFunnelAnswers(JSON.stringify(profile.funnel_answers));
    if (isComplete(answers)) {
      input = {
        goal: answers.goal,
        gender: answers.gender,
        age: answers.age,
        heightCm: answers.heightCm,
        weightKg: answers.weightKg,
        targetWeightKg: answers.targetWeightKg,
        activityLevel: answers.activityLevel,
        trainingDays: answers.trainingDays,
      };
      startedAt = profile.created_at;
    }
  }

  if (!input) return null;

  const parsedStart = startedAt ? Date.parse(startedAt) : NaN;
  const startAt = Number.isNaN(parsedStart) || parsedStart > now ? now : parsedStart;

  const plan = calculateFitnessPlan({ ...input, startAt });
  if (!plan.valid) return null;

  return {
    plan,
    startAt,
    elapsedWeeks: Math.floor((now - startAt) / WEEK_MS),
    elapsedDays: Math.floor((now - startAt) / 86_400_000),
    startKg: input.weightKg,
    targetKg: input.targetWeightKg,
  };
}

/**
 * Where the member is against the plan, from their own weigh-ins.
 *
 * The timeline is a forecast; this is the scale answering it. Three numbers
 * drive the card on Progress:
 *
 *   - `percent`      how much of the twelve-week change the scale has already
 *                    delivered. This is what fills the bar, so the bar moves
 *                    when they log a lower weight and not merely when a day
 *                    passes. A calendar bar fills for someone who has done
 *                    nothing; this one does not.
 *   - `planPercent`  how much the plan expected by today — the marker on the
 *                    same bar, so "am I keeping up" is something they can see.
 *   - `status`       the same comparison in a word.
 *
 * Half a kilo either side of the plan counts as on track. Bodyweight moves
 * that much between a morning and an evening, and a verdict that flips on
 * water is a verdict nobody should be shown.
 */
export type JourneyStatus = "on_track" | "ahead" | "behind";

export type JourneyProgress = {
  /** The plan's weight for today, interpolated between its stops. */
  expectedKg: number;
  /** Signed change the plan aims for across the twelve weeks. */
  goalDeltaKg: number;
  /** Signed change the scale shows since the start. */
  movedKg: number;
  /** 0–100: the share of the twelve-week change already on the scale. */
  percent: number;
  /** 0–100: the share the plan expected by today. */
  planPercent: number;
  status: JourneyStatus;
  /** How far from the plan, in kg, always positive. */
  gapKg: number;
};

/** A weigh-in within this much of the plan is "on track". */
export const ON_TRACK_KG = 0.5;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** The plan's weight `days` after the start, on a straight line between stops. */
export function expectedKgAt(plan: FitnessPlan, days: number): number {
  const stops = plan.timeline;
  if (stops.length === 0) return 0;
  const week = Math.max(0, days / 7);
  const lastStop = stops[stops.length - 1];
  if (week >= lastStop.week) return lastStop.kg;
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    if (week <= to.week) {
      const span = to.week - from.week || 1;
      return from.kg + ((week - from.week) / span) * (to.kg - from.kg);
    }
  }
  return lastStop.kg;
}

export function journeyProgress(journey: Journey, latestKg: number): JourneyProgress | null {
  const { plan, startKg, elapsedDays } = journey;
  const stops = plan.timeline;
  if (plan.kind !== "scale" || stops.length < 2) return null;

  const goalDeltaKg = stops[stops.length - 1].kg - startKg;
  // No meaningful change planned: nothing for a bar to measure.
  if (Math.abs(goalDeltaKg) < 0.5) return null;

  const expectedKg = expectedKgAt(plan, elapsedDays);
  const movedKg = latestKg - startKg;

  // Positive when the scale is further along than the plan, whichever way the
  // plan points: lighter than expected on a cut, heavier on a gain.
  const towards = goalDeltaKg < 0 ? -1 : 1;
  const lead = (latestKg - expectedKg) * towards;

  return {
    expectedKg,
    goalDeltaKg,
    movedKg,
    percent: clampPercent((movedKg / goalDeltaKg) * 100),
    planPercent: clampPercent(((expectedKg - startKg) / goalDeltaKg) * 100),
    status: lead > ON_TRACK_KG ? "ahead" : lead < -ON_TRACK_KG ? "behind" : "on_track",
    gapKg: Math.abs(lead),
  };
}

/**
 * Has the scale reached a stop on the track?
 *
 * Judged against the near edge of the stop's band, not its centre: the band is
 * what the plan actually claims ("~85–86 kg"), so standing inside it is having
 * arrived. The start is always reached.
 */
export function stopReached(
  stop: { week: number; lowKg: number; highKg: number },
  latestKg: number,
  direction: "down" | "up" | "hold",
): boolean {
  if (stop.week === 0) return true;
  if (direction === "up") return latestKg >= stop.lowKg;
  return latestKg <= stop.highKg;
}
