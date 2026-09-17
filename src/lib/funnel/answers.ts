/**
 * What the sign-up funnel asks, and what it does with the answers.
 *
 * `/start` is the screen an ad points at. It is a questionnaire, but the
 * questions are not there to fill a database — they are there because a
 * stranger who has answered eleven questions about their own body has spent
 * four minutes thinking about their own training, and the plan we show them at
 * the end is *theirs*. That is the pitch. Nothing on the screen argues; the
 * reader's own answers do it.
 *
 * Two rules shape this file.
 *
 * **Nothing is asked twice.** Every key below except `experience` and `blocker`
 * is a `DietAnswers` key, spelled exactly as the real questionnaire spells it.
 * A funnel that asks your weight and then asks it again after payment tells the
 * customer the first four minutes were theatre. `toDietPrefill` hands these
 * straight to the wizard on `/diet/questions`, so the paid questionnaire opens
 * already knowing everything the funnel learned.
 *
 * **Nothing here is trusted.** These answers arrive in a cookie the user can
 * write, so they may only ever do two things: pick the copy on a marketing
 * screen, and pre-fill form fields the user is about to confirm. Every number
 * that matters is recomputed server-side from the submitted questionnaire.
 */

import type { Goal } from "@/lib/algorithms/diet-strategy";
import type { ActivityLevel } from "@/lib/algorithms/macros";

/** Where the answers live between `/start`, sign-up and the questionnaire. */
export const FUNNEL_COOKIE = "elmadhi_funnel";

/** Thirty days. Long enough to survive "I'll do it tonight", short enough to expire. */
export const FUNNEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * How long they have been training. Funnel-only: it picks which sentence the
 * reveal leads with, and nothing downstream reads it.
 */
export type Experience = "new" | "returning" | "consistent";

/**
 * The one question that is not about their body: what has stopped them before.
 *
 * It is the most useful answer on the page and it feeds nothing numeric. The
 * paywall names this back to them — a reader whose objection has already been
 * said out loud, in their words, is a reader being answered rather than sold
 * to.
 */
export type Blocker = "what_to_eat" | "no_program" | "motivation" | "no_time" | "stalled";

export type FunnelAnswers = {
  goal: Goal;
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  trainingDays: string; // "0" | "1_2" | "3_4" | "5_6" | "7"
  activityLevel: ActivityLevel;
  mealsPerDay: number; // 3 | 4 | 5
  experience: Experience;
  blocker: Blocker;
};

/** Every answer the funnel needs before it can build a plan. */
const REQUIRED_KEYS = [
  "goal",
  "gender",
  "age",
  "heightCm",
  "weightKg",
  "targetWeightKg",
  "trainingDays",
  "activityLevel",
  "mealsPerDay",
  "experience",
  "blocker",
] as const;

const GOALS: Goal[] = ["lose_fat", "maintain", "build_muscle", "recomp"];
const ACTIVITY: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const TRAINING_DAYS = ["0", "1_2", "3_4", "5_6", "7"];
const EXPERIENCE: Experience[] = ["new", "returning", "consistent"];
const BLOCKERS: Blocker[] = ["what_to_eat", "no_program", "motivation", "no_time", "stalled"];

/** Bounds every number question is clamped to, before anything reads it. */
export const LIMITS = {
  age: { min: 14, max: 90 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 250 },
  targetWeightKg: { min: 35, max: 250 },
} as const;

export function inRange(key: keyof typeof LIMITS, value: number | undefined): boolean {
  if (value === undefined || !Number.isFinite(value)) return false;
  return value >= LIMITS[key].min && value <= LIMITS[key].max;
}

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * Read a cookie's worth of answers back, keeping only what survives validation.
 *
 * Returns a partial rather than throwing: a cookie written by an older version
 * of the funnel should pre-fill the four questions it still recognises, not
 * wipe the lot. The caller decides whether what came back is enough
 * (`isComplete`).
 */
export function parseFunnelAnswers(raw: string | undefined | null): Partial<FunnelAnswers> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const input = data as Record<string, unknown>;
  const out: Partial<FunnelAnswers> = {};

  if (GOALS.includes(input.goal as Goal)) out.goal = input.goal as Goal;
  if (input.gender === "male" || input.gender === "female") out.gender = input.gender;
  if (ACTIVITY.includes(input.activityLevel as ActivityLevel)) {
    out.activityLevel = input.activityLevel as ActivityLevel;
  }
  if (typeof input.trainingDays === "string" && TRAINING_DAYS.includes(input.trainingDays)) {
    out.trainingDays = input.trainingDays;
  }
  if (EXPERIENCE.includes(input.experience as Experience)) {
    out.experience = input.experience as Experience;
  }
  if (BLOCKERS.includes(input.blocker as Blocker)) out.blocker = input.blocker as Blocker;

  const meals = num(input.mealsPerDay);
  if (meals !== undefined && [3, 4, 5].includes(meals)) out.mealsPerDay = meals;

  for (const key of ["age", "heightCm", "weightKg", "targetWeightKg"] as const) {
    const value = num(input[key]);
    if (inRange(key, value)) out[key] = value;
  }

  return out;
}

/** True when every question has an answer we would act on. */
export function isComplete(answers: Partial<FunnelAnswers>): answers is FunnelAnswers {
  return REQUIRED_KEYS.every((key) => answers[key] !== undefined);
}

export function serializeFunnelAnswers(answers: Partial<FunnelAnswers>): string {
  return JSON.stringify(answers);
}

/**
 * The funnel's answers, in the shape the real questionnaire's wizard wants.
 *
 * `QuestionWizard` takes `initialAnswers`, so this is the whole of "don't ask
 * twice": the paid questionnaire opens on the first question the funnel never
 * covered, with seven of its steps already answered and still editable.
 *
 * `age` is passed through as the questionnaire's own approximation rather than
 * a birth date — that is what `submitDietQuestions` takes, and inventing a
 * precise birthday from an age band would be making data up.
 */
export function toDietPrefill(answers: Partial<FunnelAnswers>): Record<string, unknown> {
  const prefill: Record<string, unknown> = {};
  for (const key of [
    "goal",
    "gender",
    "age",
    "heightCm",
    "weightKg",
    "targetWeightKg",
    "activityLevel",
    "trainingDays",
  ] as const) {
    if (answers[key] !== undefined) prefill[key] = answers[key];
  }
  // The wizard stores single-choice answers as strings; `mealsPerDay` is the
  // one number question answered by tapping a card, and it is cast back to a
  // number on submit. Passing 4 where "4" is expected leaves the card unlit.
  if (answers.mealsPerDay !== undefined) prefill.mealsPerDay = String(answers.mealsPerDay);
  return prefill;
}
