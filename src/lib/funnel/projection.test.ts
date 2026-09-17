import { describe, expect, it } from "vitest";
import { projectWeight, sampleCurve, type ProjectionInput } from "./projection";

/**
 * The date on the reveal is the most persuasive thing in the funnel, so these
 * tests are mostly about what it refuses to promise.
 */

const CUTTING: ProjectionInput = {
  goal: "lose_fat",
  gender: "male",
  age: 30,
  heightCm: 178,
  weightKg: 92,
  targetWeightKg: 80,
  activityLevel: "light",
};

describe("projectWeight", () => {
  it("walks a cut down to the target and dates it", () => {
    const p = projectWeight(CUTTING);
    expect(p.kind).toBe("scale");
    expect(p.endKg).toBeCloseTo(80, 5);
    expect(p.weeks).not.toBeNull();
    expect(p.date).toBeInstanceOf(Date);
    expect(p.firstWeekKg).toBeLessThan(0);
  });

  it("never promises more than 1% of bodyweight a week", () => {
    // Energy arithmetic alone would hand a 140 kg man well over a kilo a week
    // on a 15% deficit. Bodies do not do that, and a promise broken in month
    // one costs more than the sign-up it won.
    const p = projectWeight({ ...CUTTING, weightKg: 140, targetWeightKg: 90 });
    expect(Math.abs(p.firstWeekKg)).toBeLessThanOrEqual(1.4 + 1e-9);
  });

  it("never promises more than a quarter kilo a week of gain", () => {
    const p = projectWeight({
      ...CUTTING,
      goal: "build_muscle",
      weightKg: 60,
      targetWeightKg: 72,
    });
    expect(p.firstWeekKg).toBeGreaterThan(0);
    expect(p.firstWeekKg).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it("slows down as the body gets smaller", () => {
    // A straight line is the tell of a made-up chart. Each simulated week is
    // re-costed against the new weight, so the last week moves less than the
    // first — which is what a real cut does.
    const p = projectWeight({ ...CUTTING, weightKg: 120, targetWeightKg: 75 });
    const first = p.points[1].kg - p.points[0].kg;
    const last = p.points[p.points.length - 1].kg - p.points[p.points.length - 2].kg;
    expect(Math.abs(last)).toBeLessThan(Math.abs(first));
  });

  it("refuses a date it cannot reach inside two years", () => {
    const p = projectWeight({ ...CUTTING, weightKg: 200, targetWeightKg: 70 });
    expect(p.weeks).toBeNull();
    expect(p.date).toBeNull();
    // The curve is still drawn — it just stops where the honesty does.
    expect(p.points.length).toBeGreaterThan(2);
  });

  it("treats maintenance as a recomposition, not a flat line with a date", () => {
    const p = projectWeight({ ...CUTTING, goal: "maintain", targetWeightKg: 92 });
    expect(p.kind).toBe("recomposition");
    expect(p.weeks).toBeNull();
    expect(p.firstWeekKg).toBe(0);
  });

  it("treats a target within a kilo of today the same way", () => {
    const p = projectWeight({ ...CUTTING, targetWeightKg: 91.5 });
    expect(p.kind).toBe("recomposition");
  });

  it("stops rather than walking the wrong way when goal and target disagree", () => {
    // "Build muscle" with a lower target weight: the plan is a surplus, so the
    // scale goes up and the target is never met. Two years of a rising line
    // towards a lower number would be worse than useless.
    const p = projectWeight({ ...CUTTING, goal: "build_muscle", targetWeightKg: 80 });
    expect(p.weeks).toBeNull();
    expect(p.endKg).toBeGreaterThanOrEqual(CUTTING.weightKg);
  });

  it("never overshoots the number they typed", () => {
    const p = projectWeight({ ...CUTTING, targetWeightKg: 85 });
    for (const point of p.points) expect(point.kg).toBeGreaterThanOrEqual(85);
  });

  it("gives the same calories the plan would", () => {
    // The reveal and the paid plan must not disagree: both go through
    // calculateMacros with the same inputs.
    const p = projectWeight(CUTTING);
    expect(p.targets.calories).toBeLessThan(p.targets.tdee);
    expect(p.targets.proteinG).toBeGreaterThan(0);
  });

  it("always returns a drawable curve", () => {
    const p = projectWeight({ ...CUTTING, goal: "maintain", targetWeightKg: 92 });
    expect(p.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe("sampleCurve", () => {
  it("leaves a short curve alone", () => {
    const points = [
      { week: 0, kg: 90 },
      { week: 1, kg: 89 },
    ];
    expect(sampleCurve(points)).toEqual(points);
  });

  it("thins a long one but keeps both ends", () => {
    const points = Array.from({ length: 104 }, (_, i) => ({ week: i, kg: 100 - i * 0.2 }));
    const sampled = sampleCurve(points, 26);
    expect(sampled).toHaveLength(26);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1]);
  });
});
