/**
 * The gates. Each one turns a clinician's answer — or the absence of one —
 * into a decision the UI can render and the session recorder can enforce.
 *
 * Two rules run through all of them:
 *
 *   1. **A missing answer is a restriction, never a permission.** `"unknown"`
 *      and the clinician's "no" produce the same behaviour everywhere in this
 *      file. They differ only in what the app says about them: one asks for a
 *      letter, the other reports a decision.
 *
 *   2. **The app never invents a clinical number.** Where a threshold has not
 *      been set, a reading is recorded and shown but NOT judged — the result is
 *      `"unjudged"`, and the screen says whose job it is to fill that in. There
 *      is no fallback constant for a glucose floor or a blood-pressure ceiling
 *      anywhere in this module, and adding one would be the bug.
 *
 * Pure and client-safe.
 */

import {
  accessArm,
  hasCondition,
  onInsulin,
  type ClinicalProfile,
} from "./types";

export type GateLevel = "open" | "restricted" | "blocked";

export type Gate = {
  level: GateLevel;
  /** i18n key for the one-line explanation shown next to whatever is gated. */
  reasonKey: string;
  /** Who has to act for this gate to change. Null when nobody: it is already open. */
  waitingOn: "orthopedist" | "cardiologist" | "diabetologist" | "dialysis_unit" | null;
};

/** Muscles the orthopedist's line governs. Anything else is upper body or core. */
export const LOWER_BODY_MUSCLES = ["quads", "hamstrings", "glutes", "calves"] as const;

// ============================================================
// Lower body — the orthopedist's gate
// ============================================================

export type LowerBodyPermission = {
  gate: Gate;
  /** Loaded leg work: leg press, squats, anything carrying external load. */
  loaded: boolean;
  /** Seated or lying leg work with no body weight through the joint. */
  seatedUnloaded: boolean;
  /** Standing at all — including bodyweight calf raises and supported marching. */
  standing: boolean;
};

/**
 * "Everything here is gated by one line from an orthopedist: full
 * weight-bearing, partial, or none. Until you have it, the program is upper
 * body and seated work only."
 *
 * `"unknown"` is therefore identical to `"none"` in what it permits, and the
 * two are distinguished only by `reasonKey` — one is a question outstanding,
 * the other is an answer received.
 */
export function lowerBodyPermission(profile: ClinicalProfile | null): LowerBodyPermission {
  switch (profile?.weightBearing) {
    case "full":
      return {
        gate: { level: "open", reasonKey: "care.wb_full", waitingOn: null },
        loaded: true,
        seatedUnloaded: true,
        standing: true,
      };
    case "partial":
      // Partial means some load through the limb, decided by a clinician who
      // is not us. The product's reading of that is: supported and seated leg
      // work yes, standing yes, external load on the legs no — because
      // "partial" gives no number, and picking one would be inventing it.
      return {
        gate: { level: "restricted", reasonKey: "care.wb_partial", waitingOn: null },
        loaded: false,
        seatedUnloaded: true,
        standing: true,
      };
    case "none":
      return {
        gate: { level: "blocked", reasonKey: "care.wb_none", waitingOn: null },
        loaded: false,
        seatedUnloaded: false,
        standing: false,
      };
    default:
      return {
        gate: {
          level: "blocked",
          reasonKey: "care.wb_unknown",
          waitingOn: "orthopedist",
        },
        loaded: false,
        seatedUnloaded: false,
        standing: false,
      };
  }
}

/**
 * Is this exercise available to him today?
 *
 * Deliberately conservative about what counts as a leg movement: `secondary`
 * muscles count too, so a standing overhead press does not slip through as
 * "shoulders" while putting his full body weight through a knee.
 */
export function exerciseAllowed(
  profile: ClinicalProfile | null,
  exercise: {
    primaryMuscle: string | null;
    secondaryMuscles?: string[] | null;
    equipment?: string | null;
    /** True when the movement cannot be done seated or supported. */
    requiresStanding?: boolean;
  },
): Gate {
  const legs = lowerBodyPermission(profile);
  const lower = ([exercise.primaryMuscle, ...(exercise.secondaryMuscles ?? [])] as (string | null)[])
    .filter((m): m is string => m !== null)
    .some((m) => (LOWER_BODY_MUSCLES as readonly string[]).includes(m));

  if (lower) {
    const loaded = exercise.equipment !== "bodyweight";
    if (loaded && !legs.loaded) return legs.gate;
    if (!loaded && !legs.seatedUnloaded) return legs.gate;
  }
  if (exercise.requiresStanding && !legs.standing) return legs.gate;

  // Seated-or-supported is the session default until a clinician lifts it, and
  // it applies to upper body too: a standing dumbbell press with a blood
  // pressure that has never been cleared is the exact combination this rule
  // exists to prevent.
  if (exercise.requiresStanding && profile?.seatedOrSupportedOnly) {
    return { level: "blocked", reasonKey: "care.seated_only", waitingOn: null };
  }

  return { level: "open", reasonKey: "care.exercise_ok", waitingOn: null };
}

// ============================================================
// Intensity — the blood pressure cap
// ============================================================

export type SessionShape = {
  minMinutes: number;
  maxMinutes: number;
  restSecondsMin: number;
  /** Effort ceiling out of 10. The hard stop, not a target to reach. */
  effortCeiling: number;
  seatedOnly: boolean;
  gate: Gate;
};

/**
 * "Intensity is capped by his blood pressure clearance, not by how he feels
 * that day."
 *
 * `not_cleared` blocks outright — a clinician has said no. `unknown` does not
 * block, because that would leave a man who has been told to exercise with an
 * app that refuses to open, and the likely result of that is training with no
 * app at all. It gives the floor instead: the shortest session, the lowest
 * effort, seated, and — see `sessionReadiness` — a blood-pressure reading
 * required before every single session rather than a threshold judged for him.
 */
export function sessionShape(profile: ClinicalProfile | null): SessionShape {
  const base = {
    minMinutes: profile?.sessionMinMinutes ?? 15,
    maxMinutes: profile?.sessionMaxMinutes ?? 25,
    restSecondsMin: profile?.restSecondsMin ?? 120,
    seatedOnly: profile?.seatedOrSupportedOnly ?? true,
  };
  const ceiling = profile?.effortCeiling ?? 4;

  // The cap is scoped to the conditions it is about. A care file opened for,
  // say, an orthopedic restriction alone has no blood-pressure question in it,
  // and reading the untouched `"unknown"` on that row as "cap everything at
  // 2/10" would be this module inventing a restriction rather than applying
  // one. Dialysis counts alongside hypertension here: pressure swings around a
  // session are part of the treatment, not a separate diagnosis.
  const bpApplies =
    hasCondition(profile, "hypertension") || hasCondition(profile, "dialysis");
  if (!bpApplies) {
    return {
      ...base,
      effortCeiling: ceiling,
      gate: { level: "open", reasonKey: "care.exercise_ok", waitingOn: null },
    };
  }

  switch (profile?.bpClearance) {
    case "moderate":
      return {
        ...base,
        effortCeiling: ceiling,
        gate: { level: "open", reasonKey: "care.bp_moderate", waitingOn: null },
      };
    case "light_only":
      return {
        ...base,
        maxMinutes: Math.min(base.maxMinutes, 20),
        effortCeiling: Math.min(ceiling, 3),
        gate: { level: "restricted", reasonKey: "care.bp_light_only", waitingOn: null },
      };
    case "not_cleared":
      return {
        ...base,
        maxMinutes: base.minMinutes,
        effortCeiling: 1,
        seatedOnly: true,
        gate: {
          level: "blocked",
          reasonKey: "care.bp_not_cleared",
          waitingOn: "cardiologist",
        },
      };
    default:
      return {
        ...base,
        maxMinutes: Math.min(base.maxMinutes, base.minMinutes),
        effortCeiling: Math.min(ceiling, 2),
        seatedOnly: true,
        gate: {
          level: "restricted",
          reasonKey: "care.bp_unknown",
          waitingOn: "cardiologist",
        },
      };
  }
}

// ============================================================
// The two readings
// ============================================================

export type ReadingVerdict = {
  outcome: "in_range" | "below_range" | "above_range" | "unjudged";
  level: GateLevel;
  reasonKey: string;
  waitingOn: Gate["waitingOn"];
};

/**
 * Judge a glucose reading against the window his diabetologist set.
 *
 * With no window on file the reading is recorded and displayed and the verdict
 * is `unjudged` — never `in_range`. "Hype just logs and displays it" is the
 * literal specification for this feature, and the skip rule belongs to the
 * range, which belongs to the doctor.
 */
export function judgeGlucose(
  profile: ClinicalProfile | null,
  mgdl: number,
): ReadingVerdict {
  const floor = profile?.glucoseFloorMgdl ?? null;
  const ceiling = profile?.glucoseCeilingMgdl ?? null;

  if (floor === null || ceiling === null) {
    return {
      outcome: "unjudged",
      level: "restricted",
      reasonKey: "care.glucose_no_range",
      waitingOn: "diabetologist",
    };
  }
  if (mgdl < floor) {
    return {
      outcome: "below_range",
      level: "blocked",
      reasonKey: "care.glucose_below",
      waitingOn: null,
    };
  }
  if (mgdl > ceiling) {
    return {
      outcome: "above_range",
      level: "blocked",
      reasonKey: "care.glucose_above",
      waitingOn: null,
    };
  }
  return {
    outcome: "in_range",
    level: "open",
    reasonKey: "care.glucose_in_range",
    waitingOn: null,
  };
}

/** The same shape for blood pressure, against the skip-above thresholds. */
export function judgeBloodPressure(
  profile: ClinicalProfile | null,
  systolic: number,
  diastolic: number,
): ReadingVerdict {
  const sysCap = profile?.bpSkipAboveSystolic ?? null;
  const diaCap = profile?.bpSkipAboveDiastolic ?? null;

  if (sysCap === null && diaCap === null) {
    return {
      outcome: "unjudged",
      level: "restricted",
      reasonKey: "care.bp_no_threshold",
      waitingOn: "cardiologist",
    };
  }
  if ((sysCap !== null && systolic > sysCap) || (diaCap !== null && diastolic > diaCap)) {
    return {
      outcome: "above_range",
      level: "blocked",
      reasonKey: "care.bp_above_threshold",
      waitingOn: null,
    };
  }
  return {
    outcome: "in_range",
    level: "open",
    reasonKey: "care.bp_in_range",
    waitingOn: null,
  };
}

// ============================================================
// The access limb
// ============================================================

export type AccessRestriction = {
  arm: "left" | "right" | "none" | "unknown";
  /** Show the "no cuff on this arm" warning next to the BP input. */
  cuffWarning: boolean;
  /** Show the "no load through this arm" warning on the session screen. */
  loadWarning: boolean;
  reasonKey: string;
};

/**
 * "If he has a fistula in an arm, that limb has its own restrictions on load
 * and blood pressure cuffs, which the unit will tell you."
 *
 * The app does not decide those restrictions — it surfaces that they exist, on
 * the two screens where somebody is about to put a cuff on an arm or a
 * dumbbell in a hand, and names the unit as the source.
 */
export function accessRestriction(profile: ClinicalProfile | null): AccessRestriction {
  const arm = accessArm(profile);
  if (arm === "left" || arm === "right") {
    return {
      arm,
      cuffWarning: true,
      loadWarning: true,
      reasonKey: arm === "left" ? "care.access_left" : "care.access_right",
    };
  }
  if (arm === "unknown") {
    return {
      arm,
      cuffWarning: true,
      loadWarning: true,
      reasonKey: "care.access_unknown",
    };
  }
  return { arm: "none", cuffWarning: false, loadWarning: false, reasonKey: "care.access_none" };
}

// ============================================================
// The pre-session checklist, assembled
// ============================================================

export type Blocker = {
  key: string;
  level: Exclude<GateLevel, "open">;
  waitingOn: Gate["waitingOn"];
};

export type Readiness = {
  /** False when anything is `blocked`. Warnings alone do not stop a session. */
  allowed: boolean;
  blockers: Blocker[];
  warnings: Blocker[];
  shape: SessionShape;
};

export type PreSessionReadings = {
  /** Today's pre-session glucose in mg/dL, or null if not taken yet. */
  glucoseMgdl: number | null;
  bp: { systolic: number; diastolic: number } | null;
};

/**
 * Everything the "Start session" button needs, in one answer.
 *
 * The day-type check is NOT here: it comes from `schedule.canTrainAt`, and the
 * session screen asks both. Keeping them apart is what lets the /care screen
 * show "today is a dialysis day" and "your BP is not on file" as two separate
 * facts rather than one merged sentence that hides which is which.
 *
 * The glucose requirement is unconditional for an insulin user — "check
 * before, check after" — and it is a blocker rather than a warning, because a
 * protocol you can tap past is not a protocol.
 */
export function sessionReadiness(
  profile: ClinicalProfile | null,
  readings: PreSessionReadings,
): Readiness {
  const shape = sessionShape(profile);
  const blockers: Blocker[] = [];
  const warnings: Blocker[] = [];

  const push = (level: GateLevel, key: string, waitingOn: Gate["waitingOn"]) => {
    if (level === "blocked") blockers.push({ key, level, waitingOn });
    else if (level === "restricted") warnings.push({ key, level, waitingOn });
  };

  push(shape.gate.level, shape.gate.reasonKey, shape.gate.waitingOn);

  if (onInsulin(profile)) {
    if (readings.glucoseMgdl === null) {
      blockers.push({
        key: "care.glucose_not_taken",
        level: "blocked",
        waitingOn: null,
      });
    } else {
      const verdict = judgeGlucose(profile, readings.glucoseMgdl);
      push(verdict.level, verdict.reasonKey, verdict.waitingOn);
    }
  }

  if (hasCondition(profile, "hypertension")) {
    if (readings.bp === null) {
      // Only a blocker while the clearance is missing: without a cleared
      // intensity cap, the reading is the only thing standing in for one.
      const level: GateLevel =
        profile?.bpClearance === "moderate" || profile?.bpClearance === "light_only"
          ? "restricted"
          : "blocked";
      push(level, "care.bp_not_taken", null);
    } else {
      const verdict = judgeBloodPressure(profile, readings.bp.systolic, readings.bp.diastolic);
      push(verdict.level, verdict.reasonKey, verdict.waitingOn);
    }
  }

  const legs = lowerBodyPermission(profile);
  if (legs.gate.level !== "open") {
    // Never a blocker: it closes the leg half of the program, not the session.
    // "Upper body and seated work only" is a program, and it runs today.
    warnings.push({
      key: legs.gate.reasonKey,
      level: "restricted",
      waitingOn: legs.gate.waitingOn,
    });
  }

  return { allowed: blockers.length === 0, blockers, warnings, shape };
}

/**
 * The outstanding letters, in the order they unlock the most.
 *
 * This is the /care screen's to-do list and the coach's actual job list. It is
 * derived rather than stored so it can never disagree with the gates: an item
 * is on it exactly when some gate is still waiting on that clinician.
 */
export function outstandingClearances(
  profile: ClinicalProfile | null,
): { waitingOn: NonNullable<Gate["waitingOn"]>; reasonKey: string }[] {
  const items: { waitingOn: NonNullable<Gate["waitingOn"]>; reasonKey: string }[] = [];

  if (lowerBodyPermission(profile).gate.waitingOn === "orthopedist") {
    items.push({ waitingOn: "orthopedist", reasonKey: "care.need_weight_bearing" });
  }
  // Same scoping as `sessionShape`: only ask for a clearance the file is
  // actually about, or the checklist tells the coach to chase a letter nobody
  // needs.
  if (
    (hasCondition(profile, "hypertension") || hasCondition(profile, "dialysis")) &&
    (profile?.bpClearance === "unknown" || profile?.bpSkipAboveSystolic === null)
  ) {
    items.push({ waitingOn: "cardiologist", reasonKey: "care.need_bp_clearance" });
  }
  if (onInsulin(profile) && profile?.glucoseFloorMgdl === null) {
    items.push({ waitingOn: "diabetologist", reasonKey: "care.need_glucose_range" });
  }
  if (hasCondition(profile, "dialysis")) {
    if (profile?.dialysisDays.length === 0 || !profile?.dialysisStartTime) {
      items.push({ waitingOn: "dialysis_unit", reasonKey: "care.need_schedule" });
    }
    if (accessArm(profile) === "unknown") {
      items.push({ waitingOn: "dialysis_unit", reasonKey: "care.need_access" });
    }
  }
  return items;
}
