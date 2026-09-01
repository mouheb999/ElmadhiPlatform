/**
 * The week, split into day types.
 *
 * "Dialysis days and non-dialysis days are treated as completely different day
 * types." This file is that sentence, made computable. It answers two
 * questions and nothing else:
 *
 *   1. What kind of day is this?                      `dayPlan()`
 *   2. May he train right now, and if not, when?      `trainingWindow()` / `canTrainAt()`
 *
 * The window it computes is deliberately narrow. Around a session there are
 * two exclusions, and they come from opposite directions:
 *
 *   - AFTER: `postSessionRecoveryHours`. Most patients are washed out for
 *     hours afterwards, so nothing is scheduled inside this. The default of 24
 *     means "not the same day, and not the morning after" — but it is a column
 *     on his profile, not a constant here, because the real number is the one
 *     his coach reads off his own reported energy pattern.
 *
 *   - BEFORE: `preSessionBufferHours`. "Never right after, or well before a
 *     session" — training close to a session means arriving at the unit
 *     already depleted, so a training window that would run into the buffer
 *     does not open at all.
 *
 * Every unknown closes the window rather than opening it. No dialysis days on
 * file means no day can be called a training day: the app says it needs the
 * schedule instead of guessing that today is probably fine.
 *
 * Pure and client-safe — `now` is always a parameter.
 */

import { isoWeekday, nextDateKey, prevDateKey, tunisDateKey, tunisInstantUtc } from "@/lib/dates";
import { hasCondition, type ClinicalProfile, type Weekday } from "./types";

export type DayType =
  /** A session day at the unit. Training only in an early window, if one fits. */
  | "dialysis"
  /** The washed-out stretch after a session has eaten this whole day. */
  | "recovery"
  /** An off-day. The day type this program is built around. */
  | "training"
  /** Dialysis is in play but the schedule isn't on file, so nothing can be typed. */
  | "unknown";

export type DayPlan = {
  dateKey: string;
  type: DayType;
  /** The session at the unit on this day, if there is one (UTC instants). */
  dialysis: { startsAt: Date; endsAt: Date } | null;
  /**
   * The stretch of this day training may happen in, or null when none fits.
   * `opensAt`/`closesAt` are UTC instants inside this Tunis day.
   */
  window: { opensAt: Date; closesAt: Date } | null;
  /** i18n key naming why the window is shaped the way it is. */
  reasonKey: string;
};

const HOUR_MS = 3_600_000;

/** Start/end of a Tunis calendar day as UTC instants. */
function dayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: tunisInstantUtc(dateKey, "00:00"),
    end: tunisInstantUtc(nextDateKey(dateKey), "00:00"),
  };
}

/**
 * The dialysis session on a given day, or null. Needs both a day in
 * `dialysisDays` and a start time — a day we know he attends but not when is
 * not a session we can schedule around, and pretending otherwise would put a
 * training window on top of it.
 */
function sessionOn(
  profile: ClinicalProfile,
  dateKey: string,
): { startsAt: Date; endsAt: Date } | null {
  const weekday = isoWeekday(dateKey) as Weekday;
  if (!profile.dialysisDays.includes(weekday)) return null;
  if (!profile.dialysisStartTime) return null;
  const startsAt = tunisInstantUtc(dateKey, profile.dialysisStartTime);
  const minutes = profile.dialysisDurationMinutes ?? 240; // a standard 4-hour run
  return { startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) };
}

/**
 * What this day is, and when — if at all — it is trainable.
 *
 * The order of the checks is the safety argument: a day is disqualified by the
 * session on it, then by the session before it, and only what survives both is
 * offered as training time.
 */
export function dayPlan(profile: ClinicalProfile | null, dateKey: string): DayPlan {
  const bounds = dayBounds(dateKey);
  const fullDay = { opensAt: bounds.start, closesAt: bounds.end };

  // No care profile, or no dialysis: this file has nothing to say and must not
  // invent a restriction. The BP and glucose gates still apply — they live in
  // gates.ts and are asked separately.
  if (!profile || !hasCondition(profile, "dialysis")) {
    return {
      dateKey,
      type: "training",
      dialysis: null,
      window: fullDay,
      reasonKey: "care.reason_no_dialysis_schedule_needed",
    };
  }

  // Dialysis, but we do not know which days. Nothing is typed and nothing is
  // offered: "probably an off-day" is not a thing this product gets to think.
  if (profile.dialysisDays.length === 0) {
    return {
      dateKey,
      type: "unknown",
      dialysis: null,
      window: null,
      reasonKey: "care.reason_schedule_missing",
    };
  }

  const today = sessionOn(profile, dateKey);
  const isSessionDay = profile.dialysisDays.includes(isoWeekday(dateKey) as Weekday);

  // A session day with no time on file. We know he is at the unit; we do not
  // know when, so no part of the day can be called safe.
  if (isSessionDay && !today) {
    return {
      dateKey,
      type: "dialysis",
      dialysis: null,
      window: null,
      reasonKey: "care.reason_session_time_missing",
    };
  }

  if (today) {
    // The only trainable stretch on a session day is before the buffer in
    // front of it. Anything after the session belongs to recovery, which by
    // default runs past midnight anyway.
    const bufferOpensAt = new Date(
      today.startsAt.getTime() - profile.preSessionBufferHours * HOUR_MS,
    );
    // …and it has to clear the recovery window of the PREVIOUS session too,
    // which on consecutive dialysis days is what actually closes this gap.
    const earliest = laterOf(bounds.start, recoveryEndBefore(profile, dateKey));
    const fits =
      bufferOpensAt.getTime() - earliest.getTime() >=
      profile.sessionMinMinutes * 60_000;

    return {
      dateKey,
      type: "dialysis",
      dialysis: today,
      window: fits ? { opensAt: earliest, closesAt: bufferOpensAt } : null,
      reasonKey: fits ? "care.reason_before_session" : "care.reason_dialysis_day",
    };
  }

  // An off-day. It starts trainable whenever the previous session's recovery
  // window ends — which may be part-way through it, or after it entirely.
  const recoveryEnds = recoveryEndBefore(profile, dateKey);
  const opensAt = laterOf(bounds.start, recoveryEnds);

  if (opensAt.getTime() >= bounds.end.getTime()) {
    return {
      dateKey,
      type: "recovery",
      dialysis: null,
      window: null,
      reasonKey: "care.reason_recovering",
    };
  }

  // The next session's buffer can also reach backwards into an off-day, when
  // the day after is a session day with an early start.
  const nextSession = sessionOn(profile, nextDateKey(dateKey));
  const closesAt = nextSession
    ? earlierOf(
        bounds.end,
        new Date(nextSession.startsAt.getTime() - profile.preSessionBufferHours * HOUR_MS),
      )
    : bounds.end;

  const fits = closesAt.getTime() - opensAt.getTime() >= profile.sessionMinMinutes * 60_000;
  return {
    dateKey,
    type: fits ? "training" : "recovery",
    dialysis: null,
    window: fits ? { opensAt, closesAt } : null,
    reasonKey: fits
      ? opensAt.getTime() > bounds.start.getTime()
        ? "care.reason_after_recovery"
        : "care.reason_off_day"
      : "care.reason_recovering",
  };
}

/**
 * When the most recent session at or before this day stops counting.
 *
 * Looks back seven days, which is one full cycle of a weekday-keyed schedule —
 * beyond that there is nothing new to find, only the same weekdays again.
 */
function recoveryEndBefore(profile: ClinicalProfile, dateKey: string): Date {
  let cursor = prevDateKey(dateKey);
  for (let i = 0; i < 7; i += 1) {
    const session = sessionOn(profile, cursor);
    if (session) {
      return new Date(
        session.endsAt.getTime() + profile.postSessionRecoveryHours * HOUR_MS,
      );
    }
    // A session day with no time on file: treat the whole of it as a session
    // and recover from its end, which is the conservative reading.
    if (profile.dialysisDays.includes(isoWeekday(cursor) as Weekday)) {
      return new Date(
        dayBounds(cursor).end.getTime() + profile.postSessionRecoveryHours * HOUR_MS,
      );
    }
    cursor = prevDateKey(cursor);
  }
  return new Date(0);
}

function laterOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}
function earlierOf(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * May he start a session at this instant?
 *
 * The day type is the headline; this is the one the "Start session" button
 * asks, because a training day still has hours in it that are not training
 * hours.
 */
export function canTrainAt(
  profile: ClinicalProfile | null,
  now: Date = new Date(),
): { allowed: boolean; plan: DayPlan; reasonKey: string } {
  const plan = dayPlan(profile, tunisDateKey(now));
  if (!plan.window) return { allowed: false, plan, reasonKey: plan.reasonKey };

  const t = now.getTime();
  if (t < plan.window.opensAt.getTime()) {
    return { allowed: false, plan, reasonKey: "care.reason_window_not_open" };
  }
  if (t >= plan.window.closesAt.getTime()) {
    return {
      allowed: false,
      plan,
      reasonKey: plan.dialysis ? "care.reason_too_close_to_session" : "care.reason_window_closed",
    };
  }
  return { allowed: true, plan, reasonKey: plan.reasonKey };
}

/**
 * The next day with a training window, searching forward from `fromKey`
 * inclusive. Null when the schedule is unknown, since "unknown" is not a state
 * you can search your way out of.
 */
export function nextTrainingDay(
  profile: ClinicalProfile | null,
  fromKey: string,
): DayPlan | null {
  let cursor = fromKey;
  for (let i = 0; i < 14; i += 1) {
    const plan = dayPlan(profile, cursor);
    if (plan.type === "unknown") return null;
    if (plan.window) return plan;
    cursor = nextDateKey(cursor);
  }
  return null;
}

/** The week as seven typed days, starting Monday — what the /care strip renders. */
export function weekPlan(profile: ClinicalProfile | null, mondayKey: string): DayPlan[] {
  const days: DayPlan[] = [];
  let cursor = mondayKey;
  for (let i = 0; i < 7; i += 1) {
    days.push(dayPlan(profile, cursor));
    cursor = nextDateKey(cursor);
  }
  return days;
}
