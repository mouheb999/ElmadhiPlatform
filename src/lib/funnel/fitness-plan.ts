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
  activityFactorFor,
  clampNumber,
  healthyFloorKg,
  type GuidanceFlag,
  type Pace,
} from "@/lib/algorithms/energy";
import { normalizeGoal, type Goal } from "@/lib/algorithms/diet-strategy";

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
  /**
   * True when the goal and the typed target weight point in opposite
   * directions — "build muscle" with a lower target, say. The plan follows the
   * goal, and the screen says so rather than drawing a flat line.
   */
  targetContradictsGoal: boolean;
};

/** An age in years as the date of birth `calculateMacros` asks for. */
function birthDateFromAge(age: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
}

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

export function calculateFitnessPlan(input: FitnessPlanInput): FitnessPlan {
  // Everything is clamped before it reaches arithmetic, so no combination of
  // answers — missing, zero, negative, absurd — can produce NaN or Infinity.
  const age = clampNumber(input.age, 10, 100, 30);
  const heightCm = clampNumber(input.heightCm, 120, 230, 170);
  const startKg = clampNumber(input.weightKg, 30, 300, 70);
  const targetKg = clampNumber(input.targetWeightKg, 30, 300, startKg);
  const birthDate = birthDateFromAge(age);

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
    targetContradictsGoal,
  };
}
