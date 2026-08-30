/**
 * The default cardio module — HYPE cardio sheet, in code.
 *
 * Cardio is here for health and performance: heart, metabolism, conditioning,
 * recovery, long-term muscle quality. It is NOT here as a weight-loss lever,
 * and the sheet is emphatic about the two things that follow from that:
 *
 *   "Cardio does NOT change the food calories. Do NOT add burned calories back
 *    to the meal plan."
 *   "Do NOT change: workout split, exercises, sets, reps, progressive overload."
 *
 * So `caloriesBurned` below exists to be SHOWN to the user — it is the honest
 * answer to "what did that walk do?" — and nothing in the nutrition path reads
 * it. If you are about to import this module into anything under diet/, stop:
 * eating back what you burned is exactly the loop this design refuses.
 *
 * Everything here is pure. No Supabase, no i18n lookups, no dates.
 */

/** The catalog slug of the default. Speed walking, indoors or out. */
export const DEFAULT_CARDIO_SLUG = "speed-walking";

export type Experience = "beginner" | "intermediate" | "advanced";

export type CardioSchedule = {
  /** Sessions per week. A range; `minPerWeek === maxPerWeek` for beginners. */
  minPerWeek: number;
  maxPerWeek: number;
  /** Minutes per session. */
  minMinutes: number;
  maxMinutes: number;
};

/**
 * How much cardio, by training age. Straight from the sheet — conservative at
 * the start because a beginner's recovery budget is already committed to
 * getting through their lifting week.
 */
const SCHEDULES: Record<Experience, CardioSchedule> = {
  beginner: { minPerWeek: 1, maxPerWeek: 1, minMinutes: 30, maxMinutes: 30 },
  intermediate: { minPerWeek: 1, maxPerWeek: 2, minMinutes: 30, maxMinutes: 35 },
  advanced: { minPerWeek: 2, maxPerWeek: 3, minMinutes: 35, maxMinutes: 45 },
};

/**
 * `training_profiles.experience` holds the questionnaire's own option strings
 * ("Beginner (0-6 months)"), so this reads the leading word rather than
 * matching the whole label — the labels are editable copy and the buckets are
 * not.
 */
export function experienceOf(raw: string | null | undefined): Experience {
  const value = (raw ?? "").toLowerCase();
  if (value.startsWith("advanced")) return "advanced";
  if (value.startsWith("intermediate")) return "intermediate";
  return "beginner";
}

export function cardioSchedule(experience: string | null | undefined): CardioSchedule {
  return SCHEDULES[experienceOf(experience)];
}

/** The session length we propose when the user adds cardio without picking one. */
export function defaultCardioMinutes(experience: string | null | undefined): number {
  return cardioSchedule(experience).minMinutes;
}

/**
 * Whether a given training day is a good place to put cardio.
 *
 *   preferred  after Push, Pull or Upper — upper-body days leave the legs
 *              fresh, so a walk costs nothing you need tomorrow.
 *   discouraged after Legs or Lower. Not forbidden: it is the user's program
 *              and they may have exactly one free evening. But they are told.
 *   neutral    everything else, full-body days included.
 *
 * Matched on the day NAME because that is what the fixed splits carry
 * ("Push", "Pull", "Upper", "Legs", "Lower", "Full Body A"). Matching is
 * substring and case-insensitive so "Upper Body" and "Lower" both land.
 */
export type CardioPlacement = "preferred" | "neutral" | "discouraged";

export function cardioPlacement(dayName: string): CardioPlacement {
  const name = dayName.toLowerCase();
  // Checked first: "Lower" contains neither of the preferred words, but being
  // explicit about the order stops a future "Upper/Lower" day being read as
  // preferred when it is half legs.
  if (name.includes("leg") || name.includes("lower")) return "discouraged";
  if (name.includes("push") || name.includes("pull") || name.includes("upper")) return "preferred";
  return "neutral";
}

/** The day a program should suggest cardio on: the first preferred one. */
export function suggestedCardioDayIds(
  days: { id: string; dayName: string }[],
  experience: string | null | undefined,
): string[] {
  const wanted = cardioSchedule(experience).minPerWeek;
  const preferred = days.filter((d) => cardioPlacement(d.dayName) === "preferred");
  const neutral = days.filter((d) => cardioPlacement(d.dayName) === "neutral");
  // Legs days are never suggested, even when that leaves fewer than `wanted`.
  // Under-suggesting is the safe direction; the user can still add one by hand.
  return [...preferred, ...neutral].slice(0, wanted).map((d) => d.id);
}

/**
 * Burned calories, by the standard MET equation:
 *
 *     kcal = MET × 3.5 × bodyweight_kg / 200 × minutes
 *
 * An ESTIMATE, and a generous-tolerance one — it takes no account of fitness,
 * terrain or heart rate. Which is the other reason it must never be fed back
 * into the meal plan: a number with this much slack in it is fine to look at
 * and dangerous to eat against.
 */
export function caloriesBurned(input: {
  metValue: number;
  weightKg: number;
  minutes: number;
}): number {
  if (!(input.metValue > 0) || !(input.weightKg > 0) || !(input.minutes > 0)) return 0;
  return Math.round((input.metValue * 3.5 * input.weightKg) / 200 * input.minutes);
}

/** Bounds the DB CHECK also enforces, so the UI and the action agree with it. */
export const MIN_CARDIO_MINUTES = 5;
export const MAX_CARDIO_MINUTES = 120;

export function isValidCardioMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= MIN_CARDIO_MINUTES && minutes <= MAX_CARDIO_MINUTES
  );
}
