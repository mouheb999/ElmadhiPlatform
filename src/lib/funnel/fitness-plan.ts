/**
 * The whole personalised result, from one set of questionnaire answers.
 *
 * `calculateFitnessPlan` is the only thing the reveal, the checkout recap and
 * anything else that wants to show somebody their numbers should call. It does
 * not compute a calorie target of its own — it asks `calculateMacros`, which
 * asks `energy.ts` — so the number on the result page is by construction the
 * number the paid plan is built from.
 *
 * ## What was wrong with what this replaces
 *
 * The old `projectWeight` walked up to 104 simulated weeks towards whatever
 * target weight the user typed, then picked three stops out of that walk to
 * show. Two bugs fell out of it, and both are visible on the same screen:
 *
 *  1. **"0.0 kg/week."** The weekly rate was *inferred* by comparing the
 *     calorie target against TDEE. For a recomp — calories ×1.00 of TDEE — that
 *     difference is a rounding artefact, so the simulation moved −0.001 kg a
 *     week and every stop on a twelve-week track read the same weight.
 *  2. **The same date, three times.** The stops were looked up by week number
 *     with `points.find(...) ?? points[points.length - 1]`. When the walk broke
 *     out early — which it did for *any* contradictory pair of answers, such as
 *     "build muscle" with a target weight below today's — there was no week 4
 *     and no midpoint to find, so all three lookups silently returned the last
 *     point. Week 12 was rendered three times, with one date, under three
 *     different labels.
 *
 * Both are gone by construction here. The rate comes from `energy.ts` already
 * reconciled against the calories, and the timeline is a fixed set of horizons —
 * today, 4, 8, 12 weeks — each simulated to its own week and dated from its own
 * offset. There is no lookup that can miss and no fallback that can duplicate.
 *
 * ## What it does not do
 *
 * Promise anything. The weights are an estimate at a steady rate, widening as
 * the horizon gets further out, and the screen shows them as a range for that
 * reason. Nothing here claims a guaranteed outcome, and a body that should be
 * talking to a professional rather than to a calculator gets maintenance
 * calories and a pointer, not a softer deficit.
 */

import { calculateMacros, type MacroTargets } from "@/lib/algorithms/macros";
import { restingEnergy, type ActivityLevel } from "@/lib/algorithms/macros-core";
import {
  KCAL_PER_KG,
  MIN_ADULT_AGE,
  activityFactorFor,
  bmiOf,
  clampNumber,
  healthyFloorKg,
  type GuidanceFlag,
  type Pace,
} from "@/lib/algorithms/energy";
import { auditPlausibility, type PlausibilityFlag } from "@/lib/algorithms/macro-allocation";
import { normalizeGoal, type Goal } from "@/lib/algorithms/diet-strategy";
import { birthDateForAge } from "@/lib/algorithms/age";

/** The horizons the result page shows. Today plus three, all of them real. */
export const HORIZON_WEEKS = [0, 4, 8, 12] as const;

/**
 * How much slack to draw around a projected weight, per horizon.
 *
 * Energy arithmetic is an estimate and it gets less certain the further out it
 * runs — water, adherence, and a metabolism that adapts all sit inside these
 * bands. Showing "69.8 kg" in fourteen weeks would be false precision; showing
 * "~69–71 kg" is the same arithmetic, honestly stated, and it is what the screen
 * renders.
 */
function bandKgForWeek(week: number): number {
  if (week <= 0) return 0;
  if (week <= 4) return 0.4;
  if (week <= 8) return 0.7;
  return 1;
}

/**
 * Why a set of answers cannot produce a plan.
 *
 * `missing_required_inputs` — a question has no answer at all. This is the
 * common one: a stale cookie from an older version of the funnel, a reload
 * part-way through, a direct link.
 * `impossible_values` — an answer is present but cannot describe a body: a
 * negative weight, a height of zero.
 *
 * The distinction matters to the screen, not to the arithmetic. One says "we
 * need a couple more answers", the other says "that number cannot be right".
 */
export type InvalidReason =
  | "missing_required_inputs"
  | "impossible_values"
  /**
   * Under 18. Every formula in this engine — Mifflin-St Jeor, the activity
   * factors, the protein and fat bounds — is derived from and validated on
   * adults, and there is no pediatric model in this product. So the engine does
   * not approximate one: it stops before any of that arithmetic runs and the
   * screen points at a professional instead. See MIN_ADULT_AGE.
   */
  | "adult_nutrition_not_supported"
  /**
   * Maintenance is below the least we will safely prescribe, so no automated
   * plan can honour the goal: every number available is either under the safety
   * floor or above maintenance. See `floorBreaksGoal`.
   */
  | "maintenance_below_safe_floor";

/**
 * How much of a plan this is.
 *
 *   normal      — the policy was satisfied; an ordinary personalised plan.
 *   constrained — real, usable, but something had to give: the calorie floor
 *                 lifted the target above what the goal asked for, or the macro
 *                 split could not satisfy every bound at once. The pace is
 *                 slower than the goal implies and the screen says so.
 *   professional_assessment — not a plan. Under 18, or a body that should be
 *                 talking to a clinician before anybody writes it a deficit.
 */
export type PlanState = "normal" | "constrained" | "professional_assessment";

/**
 * The bounds outside which a value is not a body, as opposed to merely unusual.
 *
 * Deliberately wider than `LIMITS` in answers.ts, which is what the
 * questionnaire enforces (14-90 years, 120-230 cm, 35-250 kg). That is a
 * product decision about who this is for; this is a physical one about what
 * could exist. A 12-year-old is refused by the questionnaire and would be
 * handled safely here; a weight of -5 kg is refused by both.
 */
const POSSIBLE = {
  age: { min: 10, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 25, max: 350 },
} as const;

/**
 * Is there enough here to build somebody a plan?
 *
 * Returns the reason rather than a boolean, and checks presence before
 * plausibility so "you have not answered this" is never reported as "that value
 * is impossible".
 */
function validate(input: FitnessPlanInput): InvalidReason | null {
  if (!input || typeof input !== "object") return "missing_required_inputs";

  // Age first, and before plausibility: a 15-year-old has not given us an
  // impossible value, they have given us one this calculator must not act on.
  if (typeof input.age === "number" && Number.isFinite(input.age) && input.age < MIN_ADULT_AGE) {
    return input.age >= POSSIBLE.age.min ? "adult_nutrition_not_supported" : "impossible_values";
  }

  if (input.gender !== "male" && input.gender !== "female") return "missing_required_inputs";
  if (!ACTIVITY_LEVELS.includes(input.activityLevel)) return "missing_required_inputs";
  if (!GOALS.includes(input.goal)) return "missing_required_inputs";

  for (const key of ["age", "heightCm", "weightKg"] as const) {
    const value = input[key];
    if (value === undefined || value === null || typeof value !== "number" || Number.isNaN(value)) {
      return "missing_required_inputs";
    }
    if (!Number.isFinite(value) || value < POSSIBLE[key].min || value > POSSIBLE[key].max) {
      return "impossible_values";
    }
  }

  // Height and weight can each be plausible and still describe nobody. 35 kg at
  // 210 cm is a BMI of 7.9; the fields pass individually and the combination
  // does not exist. Checked as a pair because that is the only way to see it.
  const bmi = bmiOf(input.weightKg, input.heightCm);
  if (bmi < 10 || bmi > 100) return "impossible_values";

  // `targetWeightKg` is deliberately NOT required. Calories, macros and a rate
  // are all computable without it — a maintenance plan never had one — so an
  // unanswered target costs the projection its destination, not the plan.
  const target = input.targetWeightKg;
  if (target !== undefined && target !== null && Number.isFinite(target)) {
    if (target < POSSIBLE.weightKg.min || target > POSSIBLE.weightKg.max) return "impossible_values";
  }

  return null;
}

const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const GOALS: readonly Goal[] = ["lose_fat", "maintain", "build_muscle", "recomp"];

/** Past this the arithmetic stops being a projection and starts being a story. */
const MAX_WEEKS = 104;

/** Below this gap, the scale is not what the plan is about. */
const MEANINGFUL_KG = 1;

export type FitnessPlanInput = {
  goal: Goal;
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  /** "0" | "1_2" | "3_4" | "5_6" | "7". Optional; feeds TDEE when present. */
  trainingDays?: string | null;
  bodyFatPercent?: number | null;
  pace?: Pace | null;
};

export type TimelinePoint = {
  /** Weeks from today. 0 is today. */
  week: number;
  /** A real date, computed from this week's own offset. Never shared. */
  date: Date;
  /** The simulated weight at this horizon. */
  kg: number;
  /** The honest band around it. Equal to `kg` at week 0. */
  lowKg: number;
  highKg: number;
  /** Change from today, signed. */
  deltaKg: number;
};

export type FitnessPlan = {
  /**
   * False when the answers cannot support a plan. THE ONLY FIELD A CALLER
   * SHOULD BRANCH ON before showing anything.
   *
   * The rest of the object is still structurally complete and free of NaN when
   * this is false — a screen that forgets to check cannot crash — but the
   * numbers in it are built from fallbacks and are not a prescription. They must
   * not be rendered. See `PlanReveal`, which shows a "we need a few more
   * answers" card instead.
   */
  valid: boolean;
  invalidReason: InvalidReason | null;
  /** Calories, protein, carbs, fat, fiber, BMR, TDEE — from the shared engine. */
  targets: MacroTargets;
  goal: Goal;
  /**
   * "scale" when the plan expects the weight to move and a timeline is worth
   * drawing; "recomposition" when it is not the measure — maintenance, or a
   * target within a kilo of where they already are.
   */
  kind: "scale" | "recomposition";
  /** Signed kg per week, reconciled against the calorie target. */
  weeklyRateKg: number;
  /** The same rate as a percentage of bodyweight, always positive. */
  weeklyRatePercent: number;
  direction: "down" | "up" | "hold";
  /** Today, +4, +8, +12 weeks. Always four points, always four distinct dates. */
  timeline: TimelinePoint[];
  /** Whole weeks until the weight they typed is reached, if it is inside two years. */
  targetWeeks: number | null;
  /** The date that lands on. Null for the same reason. */
  targetDate: Date | null;
  /** True when the typed target falls inside the twelve weeks on screen. */
  targetWithinTimeline: boolean;
  /** Set when the target was softened for safety. See GuidanceFlag. */
  guidance: GuidanceFlag | null;
  /** How much of a plan this is. The screen branches on this. */
  state: PlanState;
  /**
   * True when the calorie floor lifted the target above what the goal's rate
   * asked for. The plan is real; the pace is slower than the goal implies.
   */
  constrainedByCalorieFloor: boolean;
  /**
   * Valid but unusual — a very large carbohydrate load, a very high calorie
   * target. Not errors: things the screen should be able to explain rather than
   * present without comment. See auditPlausibility.
   */
  plausibilityFlags: PlausibilityFlag[];
  /**
   * True when the calorie budget could not hold a macro split that satisfies
   * the nutrition policy, even after every permitted relaxation. The numbers
   * are the best available and are internally consistent, but this is not an
   * ordinary plan and the screen says so instead of pretending otherwise. See
   * macro-allocation.ts.
   */
  needsAdjustment: boolean;
  /**
   * True when the goal and the typed target weight point in opposite
   * directions — "build muscle" with a lower target, say. The plan follows the
   * goal, and the screen says so rather than drawing a flat line.
   */
  targetContradictsGoal: boolean;
};

/**
 * A date this many weeks out, from one shared "now".
 *
 * Taking `now` as an argument rather than reading the clock per call is what
 * guarantees the four dates are exactly 0/28/56/84 days apart — computing each
 * from its own `Date.now()` would drift by milliseconds, and across a midnight
 * boundary, by a day.
 */
function dateInWeeks(now: number, weeks: number): Date {
  return new Date(now + weeks * 7 * 86_400_000);
}

/**
 * A complete, NaN-free FitnessPlan carrying NO prescription.
 *
 * Every number is zero on purpose. A screen that ignores `valid` cannot show a
 * plausible calorie target for somebody the engine refused, because there is no
 * plausible number in here to show.
 */
function noPrescription(reason: InvalidReason): FitnessPlan {
  const now = Date.now();
  const zeroBilingual = { en: "", ar: "" };
  return {
    valid: false,
    invalidReason: reason,
    state: "professional_assessment",
    constrainedByCalorieFloor: false,
    plausibilityFlags: [],
    targets: {
      bmr: 0,
      tdee: 0,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      usedLeanMass: false,
      energy: {
        bmr: 0,
        tdee: 0,
        calories: 0,
        energyBalanceKcal: 0,
        weeklyRateKg: 0,
        weeklyRateFraction: 0,
        direction: "hold",
        activityFactor: 0,
        usedLeanMass: false,
        guidance: null,
        constrainedByFloor: false,
        floorBreaksGoal: false,
      },
      allocation: { proteinG: 0, fatG: 0, carbsG: 0, feasible: false, relaxations: [] },
      goalLabel: zeroBilingual,
      rationale: {
        bmr: zeroBilingual,
        tdee: zeroBilingual,
        target: zeroBilingual,
        protein: zeroBilingual,
        fat: zeroBilingual,
        carbs: zeroBilingual,
      },
    },
    goal: "maintain",
    kind: "recomposition",
    weeklyRateKg: 0,
    weeklyRatePercent: 0,
    direction: "hold",
    timeline: HORIZON_WEEKS.map((week) => ({
      week,
      date: dateInWeeks(now, week),
      kg: 0,
      lowKg: 0,
      highKg: 0,
      deltaKg: 0,
    })),
    targetWeeks: null,
    targetDate: null,
    targetWithinTimeline: false,
    guidance: null,
    needsAdjustment: false,
    targetContradictsGoal: false,
  };
}

export function calculateFitnessPlan(input: FitnessPlanInput): FitnessPlan {
  // Asked BEFORE anything is clamped. Clamping is what lets the arithmetic
  // survive nonsense without throwing; it is not permission to present the
  // result as somebody's personalised plan. A weight of -5 kg clamps to 30 and
  // produces a perfectly ordinary-looking 1,600 kcal prescription, and that
  // number is fiction.
  const invalidReason = validate(input ?? ({} as FitnessPlanInput));

  // Any refusal stops here. Not "compute it and hide it": an object that
  // carries 2,225 kcal for a visitor who answered nothing has invented a person,
  // and a bug downstream that forgets to check `valid` would show that number to
  // them. There is no plausible figure in a refused plan to leak.
  if (invalidReason !== null) {
    return noPrescription(invalidReason);
  }

  // Everything is clamped before it reaches arithmetic, so no combination of
  // answers — missing, zero, negative, absurd — can produce NaN or Infinity.
  const age = clampNumber(input.age, 10, 100, 30);
  const heightCm = clampNumber(input.heightCm, 120, 230, 170);
  const startKg = clampNumber(input.weightKg, 30, 300, 70);
  const targetKg = clampNumber(input.targetWeightKg, 30, 300, startKg);
  const birthDate = birthDateForAge(age);

  const macrosAt = (weightKg: number): MacroTargets =>
    calculateMacros({
      gender: input.gender,
      birthDate,
      heightCm,
      weightKg,
      activityLevel: input.activityLevel,
      goal: input.goal,
      trainingDays: input.trainingDays,
      bodyFatPercent: input.bodyFatPercent,
      pace: input.pace,
    });

  const goal = normalizeGoal(input.goal);
  const targets = macrosAt(startKg);
  const energy = targets.energy;

  // The floor turned this goal's deficit into a surplus. No honest automated
  // plan exists for this body; say so rather than printing "fat loss" over a
  // gaining projection.
  if (energy.floorBreaksGoal) {
    return noPrescription("maintenance_below_safe_floor");
  }

  const plausibilityFlags = auditPlausibility(targets);
  /**
   * Which of the three states this is.
   *
   * `underweight` guidance is the only remaining reason the engine routes an
   * adult to a professional; everything else that "gave way" is a constrained
   * plan, which is real and usable and simply says what it cost.
   */
  const planState: PlanState =
    invalidReason !== null || energy.guidance !== null
      ? "professional_assessment"
      : energy.constrainedByFloor || !targets.allocation.feasible
        ? "constrained"
        : "normal";

  const gap = targetKg - startKg;
  // Which way the plan itself pushes, which is not always the way the typed
  // target points.
  const planGoesDown = energy.direction === "down";
  const planGoesUp = energy.direction === "up";
  const targetContradictsGoal =
    Math.abs(gap) >= MEANINGFUL_KG &&
    ((gap < 0 && planGoesUp) || (gap > 0 && planGoesDown));

  // No movement expected, or none worth a chart: maintenance, a target they are
  // already standing on, or a screened plan held at maintenance. The reveal
  // renders its recomposition card instead of a timeline.
  if (energy.direction === "hold" || (Math.abs(gap) < MEANINGFUL_KG && !planGoesDown && !planGoesUp)) {
    const now = Date.now();
    return {
      valid: invalidReason === null,
      invalidReason,
      targets,
      goal,
      kind: "recomposition",
      weeklyRateKg: 0,
      weeklyRatePercent: 0,
      direction: "hold",
      timeline: HORIZON_WEEKS.map((week) => ({
        week,
        date: dateInWeeks(now, week),
        kg: startKg,
        lowKg: startKg,
        highKg: startKg,
        deltaKg: 0,
      })),
      targetWeeks: null,
      targetDate: null,
      targetWithinTimeline: false,
      guidance: energy.guidance,
      state: planState,
      constrainedByCalorieFloor: energy.constrainedByFloor,
      plausibilityFlags,
      needsAdjustment: !targets.allocation.feasible,
      targetContradictsGoal,
    };
  }

  /**
   * Walk the weeks.
   *
   * The prescribed calories are held fixed — that is what the plan tells them
   * to eat, and it does not change between check-ins — while TDEE is recomputed
   * from the falling (or rising) weight each week. So the deficit narrows as the
   * body gets smaller and the curve flattens, which is what a real one does.
   * Nobody who has dieted believes a straight line.
   */
  const factor = activityFactorFor(input.activityLevel, input.trainingDays);
  const floorKg = healthyFloorKg(heightCm);
  const calories = energy.calories;

  const weights: number[] = [startKg];
  let weight = startKg;
  let targetWeeks: number | null = null;
  // Only stop at the typed target when the plan is actually walking towards it.
  const chasingTarget = !targetContradictsGoal && Math.abs(gap) >= MEANINGFUL_KG;

  for (let week = 1; week <= MAX_WEEKS; week++) {
    const tdee = Math.round(
      restingEnergy({
        gender: input.gender,
        age,
        heightCm,
        weightKg: weight,
        bodyFatPercent: input.bodyFatPercent,
      }).value * factor,
    );
    const change = ((calories - tdee) * 7) / KCAL_PER_KG;

    // The curve has flattened to a standstill — a gainer whose TDEE has caught
    // up with their surplus. Stop rather than walk two years of nothing.
    if (Math.abs(change) < 0.005) {
      weights.push(weight);
      continue;
    }

    weight += change;

    // Never below a BMI of 18.5, whatever the arithmetic wants.
    if (weight < floorKg) weight = floorKg;

    if (chasingTarget) {
      const reached = gap < 0 ? weight <= targetKg : weight >= targetKg;
      if (reached) {
        weight = targetKg;
        if (targetWeeks === null) targetWeeks = week;
      }
    }

    weights.push(weight);
    // Past the target the plan would move to maintenance, so the line holds.
    if (targetWeeks !== null && week >= targetWeeks && week >= 12) break;
  }

  const at = (week: number): number => weights[Math.min(week, weights.length - 1)] ?? startKg;

  const now = Date.now();
  const timeline: TimelinePoint[] = HORIZON_WEEKS.map((week) => {
    const kg = at(week);
    const band = bandKgForWeek(week);
    return {
      week,
      date: dateInWeeks(now, week),
      kg,
      lowKg: Math.max(floorKg, kg - band),
      highKg: kg + band,
      deltaKg: kg - startKg,
    };
  });

  return {
    valid: invalidReason === null,
    invalidReason,
    targets,
    goal,
    kind: "scale",
    weeklyRateKg: energy.weeklyRateKg,
    weeklyRatePercent: energy.weeklyRateFraction * 100,
    direction: energy.direction,
    timeline,
    targetWeeks,
    targetDate: targetWeeks !== null ? dateInWeeks(now, targetWeeks) : null,
    targetWithinTimeline: targetWeeks !== null && targetWeeks <= 12,
    guidance: energy.guidance,
    state: planState,
    constrainedByCalorieFloor: energy.constrainedByFloor,
    plausibilityFlags,
    needsAdjustment: !targets.allocation.feasible,
    targetContradictsGoal,
  };
}
