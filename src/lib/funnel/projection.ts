/**
 * "Here is where this ends up, and when."
 *
 * The reveal at the end of `/start` shows a curve from today's weight to the
 * one they typed, with a date on it. That date is the single most persuasive
 * thing on the screen, which is exactly why the arithmetic behind it is real
 * and conservative rather than flattering.
 *
 * It is a week-by-week simulation, not a straight line:
 *
 *   - Each week's calories come from `calculateMacros` — the same function the
 *     paid product uses to write the plan. The curve and the plan cannot
 *     disagree, because they are the same code.
 *   - The deficit is converted at 7700 kcal per kilo, then **capped**: at most
 *     1% of bodyweight a week going down, and 0.25 kg a week going up. Energy
 *     arithmetic alone will happily promise 1.5 kg a week to a heavy person on
 *     a deep cut. Bodies do not do that, and a promise the first month breaks
 *     costs more than the sign-up it won.
 *   - Weight is re-fed into the next week, so a smaller body burns less and the
 *     curve flattens the way a real one does. It is the flattening that makes
 *     the chart worth showing: nobody who has dieted believes a straight line.
 *
 * Everything here is an estimate at a steady rate, and the screen says so.
 */

import { calculateMacros, type ActivityLevel, type MacroTargets } from "@/lib/algorithms/macros";
import type { Goal } from "@/lib/algorithms/diet-strategy";

/** Energy in a kilo of body mass. The standard figure, near enough. */
const KCAL_PER_KG = 7700;

/** Fat loss we will put a date on: 1% of bodyweight in a week, at the most. */
const MAX_LOSS_FRACTION = 0.01;

/** Weight gain we will put a date on. Faster than this is mostly not muscle. */
const MAX_GAIN_KG_PER_WEEK = 0.25;

/** Past this the date stops being a projection and starts being a fantasy. */
const MAX_WEEKS = 104;

/** Below this the target is the weight they are already at. */
const MEANINGFUL_KG = 1;

export type ProjectionInput = {
  goal: Goal;
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
};

export type ProjectionPoint = { week: number; kg: number };

export type Projection = {
  /** The macros the plan would open on — today's numbers, not week 12's. */
  targets: MacroTargets;
  /**
   * "recomposition" when the scale is not the story: maintenance, or a target
   * within a kilo of today. Showing a flat line with a date on it would be
   * measuring the one thing that is not supposed to move.
   */
  kind: "scale" | "recomposition";
  /** Weekly samples from today to the target. At least two points. */
  points: ProjectionPoint[];
  /** Whole weeks to the target, or null when it is not reached inside MAX_WEEKS. */
  weeks: number | null;
  /** The date `weeks` lands on, or null for the same reason. */
  date: Date | null;
  /** First-week rate, signed. What the reader will actually see on the scale. */
  firstWeekKg: number;
  /** Where the projection stops, whether or not that is the target. */
  endKg: number;
  /**
   * The journey as three or four dated stops rather than a curve.
   *
   * The endpoint is the least motivating number on the reveal. "85 kg in 34
   * weeks" is a correct answer to a question nobody is excited by; "+0.6 kg by
   * the end of next month" is the same arithmetic, near enough to picture, and
   * it is the one that decides whether somebody starts. So the screen leads
   * with the first stop and keeps the target as the destination rather than
   * the headline.
   *
   * Every figure is read off the same simulation as the curve was. Nothing is
   * rounded in the flattering direction.
   */
  milestones: Milestone[];
};

export type Milestone = {
  /** Weeks from today. 0 is today. */
  week: number;
  kg: number;
  date: Date;
  kind: "today" | "checkpoint" | "target";
};

/**
 * The first checkpoint, in weeks.
 *
 * Four weeks because that is "by the end of next month" — the shortest horizon
 * a reader can both picture and believe. Two would be more seductive and less
 * credible; eight is already abstract.
 */
const FIRST_CHECKPOINT_WEEKS = 4;

function dateInWeeks(weeks: number): Date {
  return new Date(Date.now() + weeks * 7 * 86_400_000);
}

/**
 * Three or four dated stops along the curve.
 *
 * Today, the end of next month, the middle, and the target. A journey short
 * enough that those collide loses the ones that would repeat: there is no
 * point showing week 4 and week 5 as separate milestones.
 */
function milestonesFrom(points: ProjectionPoint[], reachedAt: number | null): Milestone[] {
  const at = (week: number): ProjectionPoint =>
    points.find((p) => p.week === week) ?? points[points.length - 1];

  const last = points[points.length - 1];
  const stops: Milestone[] = [
    { week: 0, kg: points[0].kg, date: dateInWeeks(0), kind: "today" },
  ];

  const mid = Math.round(last.week / 2);
  for (const week of [FIRST_CHECKPOINT_WEEKS, mid]) {
    // Keep a checkpoint only where it is genuinely between the two ends: a
    // twelve-week plan does not need "week 4" and "week 6" both.
    if (week <= 1 || week >= last.week - 1) continue;
    if (stops.some((stop) => Math.abs(stop.week - week) < 3)) continue;
    const point = at(week);
    stops.push({ week: point.week, kg: point.kg, date: dateInWeeks(point.week), kind: "checkpoint" });
  }

  stops.push({
    week: last.week,
    kg: last.kg,
    date: dateInWeeks(last.week),
    // Only the stop that actually lands on the number they typed is the target;
    // a curve that ran out of weeks ends on a checkpoint, and says so.
    kind: reachedAt !== null ? "target" : "checkpoint",
  });

  return stops.sort((a, b) => a.week - b.week);
}

/** An age in years as the date of birth `calculateMacros` asks for. */
function birthDateFromAge(age: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
}

/**
 * How much the scale moves in one week at these calories, capped to what a
 * body can plausibly do. Sign follows the goal: negative is downward.
 */
function weeklyChangeKg(weightKg: number, calories: number, tdee: number): number {
  const raw = ((calories - tdee) * 7) / KCAL_PER_KG;
  if (raw < 0) return Math.max(raw, -MAX_LOSS_FRACTION * weightKg);
  return Math.min(raw, MAX_GAIN_KG_PER_WEEK);
}

export function projectWeight(input: ProjectionInput): Projection {
  const birthDate = birthDateFromAge(input.age);
  const macrosAt = (weightKg: number) =>
    calculateMacros({
      gender: input.gender,
      birthDate,
      heightCm: input.heightCm,
      weightKg,
      activityLevel: input.activityLevel,
      goal: input.goal,
      bodyFatPercent: null,
    });

  const targets = macrosAt(input.weightKg);
  const gap = input.targetWeightKg - input.weightKg;
  const wantsLoss = gap < 0;

  // Maintenance, or a target they are already standing on. The plan is still a
  // plan — it is just not a line on a scale, so the reveal says so instead of
  // drawing a week-by-week chart of nothing happening.
  if (input.goal === "maintain" || Math.abs(gap) < MEANINGFUL_KG) {
    return {
      targets,
      kind: "recomposition",
      points: [
        { week: 0, kg: input.weightKg },
        { week: 12, kg: input.weightKg },
      ],
      weeks: null,
      date: null,
      firstWeekKg: 0,
      endKg: input.weightKg,
      milestones: [],
    };
  }

  const points: ProjectionPoint[] = [{ week: 0, kg: input.weightKg }];
  let weight = input.weightKg;
  let firstWeekKg = 0;
  let reachedAt: number | null = null;

  for (let week = 1; week <= MAX_WEEKS; week++) {
    const weekly = macrosAt(weight);
    const change = weeklyChangeKg(weight, weekly.calories, weekly.tdee);
    if (week === 1) firstWeekKg = change;

    // The goal and the target disagree: a "build muscle" plan cannot walk down
    // to a lower target weight, and a cut cannot walk up to a higher one.
    // Stopping is honest; walking the wrong way for two years is not.
    if (change === 0 || (wantsLoss && change > 0) || (!wantsLoss && change < 0)) break;

    weight += change;

    // Do not overshoot the number they typed.
    if ((wantsLoss && weight <= input.targetWeightKg) || (!wantsLoss && weight >= input.targetWeightKg)) {
      weight = input.targetWeightKg;
      points.push({ week, kg: weight });
      reachedAt = week;
      break;
    }
    points.push({ week, kg: weight });
  }

  // A chart needs two points. One means the very first week already broke out
  // of the loop above, so the target is drawn as the flat line it is.
  if (points.length < 2) points.push({ week: 12, kg: weight });

  const date = reachedAt !== null ? new Date(Date.now() + reachedAt * 7 * 86_400_000) : null;

  return {
    targets,
    kind: "scale",
    points,
    weeks: reachedAt,
    date,
    firstWeekKg,
    endKg: weight,
    milestones: milestonesFrom(points, reachedAt),
  };
}
