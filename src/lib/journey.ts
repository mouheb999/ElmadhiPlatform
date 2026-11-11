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
