/**
 * Progression, driven by recovery and symptoms rather than by load.
 *
 * The ordinary progression engine in `lib/algorithms/progression.ts` asks "did
 * he beat the rep range, and is there reps in reserve?" and answers with a
 * heavier bar. Neither half of that question is safe here. A dialysis patient
 * who beat the rep range may simply have had a good day between sessions, and
 * the reward for it is not more weight.
 *
 * So this engine reads three things and none of them is a number lifted:
 *
 *   - whether he FINISHED the session or hit the hard stop,
 *   - how he FELT during it,
 *   - how he RECOVERED the day after.
 *
 * and it moves along a ladder of exposure, not of load:
 *
 *     stop_and_review  →  reduce  →  hold  →  add_minutes  →  add_exercise
 *
 * Minutes before exercises, and never both at once: one variable changes at a
 * time, so when something goes wrong there is exactly one thing to undo.
 *
 * Pure and client-safe.
 */

export type SymptomSeverity = "mild" | "moderate" | "severe";

export type SessionRecord = {
  /** ISO date the session happened (Tunis key). Most recent first in the array. */
  dateKey: string;
  felt: "good" | "ok" | "rough" | null;
  stoppedEarly: boolean;
  perceivedEffort: number | null;
  nextDayRecovery: "recovered" | "tired" | "wiped_out" | null;
  symptoms: { symptom: string; severity: SymptomSeverity }[];
};

export type ProgressionStep =
  /** Do not train. Something on this list belongs in front of a clinician. */
  | "stop_and_review"
  /** Shorter and easier than last time. */
  | "reduce"
  /** Exactly what he did last time. The default, and not a failure state. */
  | "hold"
  /** Same session, five more minutes, still under the ceiling. */
  | "add_minutes"
  /** Minutes are at the cap: one more exercise, same duration. */
  | "add_exercise";

export type ProgressionDecision = {
  step: ProgressionStep;
  reasonKey: string;
  /** The symptoms that drove a `reduce` or `stop_and_review`, for the UI to name. */
  triggeredBy: string[];
};

/**
 * Symptoms that end the conversation. These are not "train lighter" signals —
 * chest discomfort, breathlessness and palpitations in a dialysis patient with
 * hypertension are reasons to be looked at, and an app whose worst response to
 * them is a shorter workout is an app giving the wrong answer confidently.
 */
const RED_FLAGS = ["chest_discomfort", "breathlessness", "palpitations"] as const;

/** How many recent sessions a clean run has to cover before anything increases. */
const CLEAN_RUN = 3;

/** How far back a red flag still counts, in sessions. */
const RED_FLAG_LOOKBACK = 6;

function isRedFlag(symptom: string): boolean {
  return (RED_FLAGS as readonly string[]).includes(symptom);
}

/**
 * @param sessions most recent first. Sessions with no wellness answers yet
 *                 count as sessions, but never as clean ones — silence is not
 *                 evidence that a session went well.
 * @param minutesAtCap whether the current session length is already at the
 *                 profile's `sessionMaxMinutes`, which decides whether an
 *                 increase adds time or an exercise.
 */
export function nextProgression(
  sessions: SessionRecord[],
  minutesAtCap: boolean,
): ProgressionDecision {
  const recent = sessions.slice(0, RED_FLAG_LOOKBACK);

  const redFlags = recent.flatMap((s) =>
    s.symptoms.filter((f) => isRedFlag(f.symptom)).map((f) => f.symptom),
  );
  const severe = recent.flatMap((s) =>
    s.symptoms.filter((f) => f.severity === "severe").map((f) => f.symptom),
  );
  if (redFlags.length > 0 || severe.length > 0) {
    return {
      step: "stop_and_review",
      reasonKey: "care.prog_red_flag",
      triggeredBy: Array.from(new Set([...redFlags, ...severe])),
    };
  }

  if (sessions.length === 0) {
    return { step: "hold", reasonKey: "care.prog_no_history", triggeredBy: [] };
  }

  const last = sessions[0];
  const window = sessions.slice(0, CLEAN_RUN);

  if (last.stoppedEarly) {
    return {
      step: "reduce",
      reasonKey: "care.prog_stopped_early",
      triggeredBy: last.symptoms.map((f) => f.symptom),
    };
  }
  if (last.nextDayRecovery === "wiped_out") {
    return { step: "reduce", reasonKey: "care.prog_wiped_out", triggeredBy: [] };
  }

  const moderate = window.flatMap((s) =>
    s.symptoms.filter((f) => f.severity === "moderate").map((f) => f.symptom),
  );
  if (moderate.length >= 2) {
    return {
      step: "reduce",
      reasonKey: "care.prog_repeat_symptoms",
      triggeredBy: Array.from(new Set(moderate)),
    };
  }

  // An increase has to be earned by a full clean run — every session in it
  // answered, symptom-free, finished, and followed by a recovered day.
  const cleanRun =
    window.length >= CLEAN_RUN &&
    window.every(
      (s) =>
        s.symptoms.length === 0 &&
        !s.stoppedEarly &&
        (s.felt === "good" || s.felt === "ok") &&
        s.nextDayRecovery === "recovered",
    );

  if (cleanRun) {
    return minutesAtCap
      ? { step: "add_exercise", reasonKey: "care.prog_add_exercise", triggeredBy: [] }
      : { step: "add_minutes", reasonKey: "care.prog_add_minutes", triggeredBy: [] };
  }

  const awaiting = window.some((s) => s.nextDayRecovery === null || s.felt === null);
  return {
    step: "hold",
    reasonKey: awaiting ? "care.prog_awaiting_answers" : "care.prog_hold",
    triggeredBy: [],
  };
}

/**
 * How the decision changes the session, in the two numbers the session screen
 * actually renders. Kept next to the decision so "reduce" cannot mean one
 * thing in the UI and another in the generator.
 */
export function applyProgression(
  step: ProgressionStep,
  current: { minutes: number; exercises: number },
  bounds: { minMinutes: number; maxMinutes: number },
): { minutes: number; exercises: number } {
  switch (step) {
    case "add_minutes":
      return {
        minutes: Math.min(current.minutes + 5, bounds.maxMinutes),
        exercises: current.exercises,
      };
    case "add_exercise":
      return { minutes: current.minutes, exercises: current.exercises + 1 };
    case "reduce":
      return {
        minutes: Math.max(current.minutes - 5, bounds.minMinutes),
        exercises: Math.max(current.exercises - 1, 1),
      };
    case "stop_and_review":
    case "hold":
      return current;
  }
}
