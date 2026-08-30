import { describe, expect, it } from "vitest";
import {
  observedTdee,
  smoothTdee,
  proposeDietAdaptation,
  MAX_TDEE_CORRECTION,
  type CurrentTargets,
  type IntakeDay,
  type WeighIn,
} from "./diet-adaptation";

const WINDOW_END = "2026-08-30";

/** 14 consecutive dates ending on WINDOW_END, oldest first. */
const DAYS: string[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(`${WINDOW_END}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (13 - i));
  return d.toISOString().slice(0, 10);
});

const targets: CurrentTargets = {
  calories: 2150,
  proteinG: 160,
  carbsG: 200,
  fatG: 72,
  bmr: 1805,
  tdee: 2530,
  fiberG: 30,
};

/** A flat weight in the prior week, `deltaKg` different in the recent one. */
function weighIns(startKg: number, deltaKg: number): WeighIn[] {
  return DAYS.map((date, i) => ({
    date,
    weightKg: i < 7 ? startKg : startKg + deltaKg,
  }));
}

function intake(calories: number, days = 14): IntakeDay[] {
  return DAYS.slice(0, days).map((date) => ({ date, calories }));
}

describe("observedTdee", () => {
  // 7700 kcal to a kilogram: eating 2400 while losing 0.5 kg/week means
  // maintenance is 2400 + (0.5 * 7700 / 7) = 2400 + 550 = 2950.
  it("solves maintenance backwards out of intake and weight change", () => {
    expect(observedTdee(2400, -0.5)).toBe(2950);
    expect(observedTdee(2400, 0.5)).toBe(1850);
  });

  it("holding steady means maintenance is exactly what was eaten", () => {
    expect(observedTdee(2400, 0)).toBe(2400);
  });
});

describe("smoothTdee", () => {
  it("moves 30% of the way toward the observation", () => {
    // 0.7*2500 + 0.3*2600 = 2530
    expect(smoothTdee(2500, 2600)).toBe(2530);
  });

  it("never moves more than ±150 in one update, however wild the observation", () => {
    expect(smoothTdee(2500, 4000)).toBe(2500 + MAX_TDEE_CORRECTION);
    expect(smoothTdee(2500, 500)).toBe(2500 - MAX_TDEE_CORRECTION);
  });
});

describe("proposeDietAdaptation — guard rails", () => {
  it("refuses without at least two weigh-ins in each half of the window", () => {
    const thin = [
      { date: DAYS[0], weightKg: 80 },
      { date: DAYS[8], weightKg: 79 },
      { date: DAYS[9], weightKg: 79 },
    ];
    expect(proposeDietAdaptation("lose_fat", targets, thin, WINDOW_END, intake(2100))).toBeNull();
  });

  it("does nothing for a goal that has no pace to be off", () => {
    expect(proposeDietAdaptation("maintain", targets, weighIns(80, -0.5), WINDOW_END)).toBeNull();
    expect(proposeDietAdaptation(null, targets, weighIns(80, -0.5), WINDOW_END)).toBeNull();
  });

  it("never moves the target more than 10% in one go", () => {
    // An absurd observation: eating 3800 and still losing weight.
    const p = proposeDietAdaptation(
      "lose_fat",
      targets,
      weighIns(80, -0.6),
      WINDOW_END,
      intake(3800),
    );
    expect(p).not.toBeNull();
    expect(Math.abs(p!.deltaKcal)).toBeLessThanOrEqual(Math.round(targets.calories * 0.1));
  });

  it("never takes calories below BMR", () => {
    const p = proposeDietAdaptation(
      "lose_fat",
      { ...targets, calories: 1900, bmr: 1850 },
      weighIns(80, 0.3),
      WINDOW_END,
      intake(1500),
    );
    if (p) expect(p.newCalories).toBeGreaterThanOrEqual(1850);
  });

  it("never touches protein", () => {
    const p = proposeDietAdaptation("lose_fat", targets, weighIns(80, 0), WINDOW_END, intake(2100));
    expect(p?.newProteinG).toBe(targets.proteinG);
  });
});

describe("proposeDietAdaptation — the calibration path", () => {
  it("raises the maintenance estimate when the user eats more than we thought and holds", () => {
    // Ate 2800 and did not move: real maintenance is 2800, above our 2530.
    const p = proposeDietAdaptation(
      "lose_fat",
      targets,
      weighIns(80, 0),
      WINDOW_END,
      intake(2800),
    );
    expect(p).not.toBeNull();
    expect(p!.observedTdee).toBe(2800);
    expect(p!.reasonKey).toBe("adapt.calibrated_up");
    // 0.7*2530 + 0.3*2800 = 2611, within the ±150 cap.
    expect(p!.newTdee).toBe(2611);
    // The new target is the calibrated maintenance times the cut multiplier,
    // clamped by the 10% swing rule — so the deficit stays a real 15%.
    expect(p!.newCalories).toBeGreaterThan(targets.calories);
  });

  it("lowers it when the scale refuses to move on what should be a deficit", () => {
    const p = proposeDietAdaptation(
      "lose_fat",
      targets,
      weighIns(80, 0),
      WINDOW_END,
      intake(1900),
    );
    expect(p!.observedTdee).toBe(1900);
    expect(p!.reasonKey).toBe("adapt.calibrated_down");
    expect(p!.newTdee).toBeLessThan(targets.tdee);
    expect(p!.newCalories).toBeLessThan(targets.calories);
  });

  it("proposes nothing when the standing estimate already fits", () => {
    // Eating 2150 (the target) and losing at the pace a 2530 maintenance
    // predicts: observed lands on 2530 and the blend does not move.
    const weekly = ((2150 - 2530) * 7) / 7700; // kg/week, negative
    const p = proposeDietAdaptation(
      "lose_fat",
      targets,
      weighIns(80, weekly),
      WINDOW_END,
      intake(2150),
    );
    expect(p).toBeNull();
  });

  it("carries the calibrated maintenance out so next week blends against it", () => {
    const p = proposeDietAdaptation("build_muscle", targets, weighIns(80, 0), WINDOW_END, intake(2900));
    expect(p!.newTdee).not.toBe(targets.tdee);
    expect(p!.newTdee).toBe(smoothTdee(targets.tdee, p!.observedTdee!));
  });
});

describe("proposeDietAdaptation — the nudge fallback", () => {
  // Below 8 logged days the "average" is a floor, not a measurement.
  const tooFewDays = intake(2100, 5);

  it("moves ±100 kcal on the weight trend alone when intake is too sparse", () => {
    const stalled = proposeDietAdaptation("lose_fat", targets, weighIns(80, 0), WINDOW_END, tooFewDays);
    expect(stalled!.reasonKey).toBe("adapt.cut_stall");
    expect(stalled!.deltaKcal).toBe(-100);
    expect(stalled!.observedTdee).toBeNull();
    // A nudge does not claim to know maintenance, so the estimate is untouched.
    expect(stalled!.newTdee).toBe(targets.tdee);
  });

  it("adds calories back when a cut is running too fast", () => {
    const p = proposeDietAdaptation("lose_fat", targets, weighIns(80, -1.6), WINDOW_END, tooFewDays);
    expect(p!.reasonKey).toBe("adapt.cut_too_fast");
    expect(p!.deltaKcal).toBe(100);
  });

  it("adds calories to a stalled bulk and trims a runaway one", () => {
    expect(
      proposeDietAdaptation("build_muscle", targets, weighIns(80, 0), WINDOW_END, tooFewDays)!.deltaKcal,
    ).toBe(100);
    expect(
      proposeDietAdaptation("build_muscle", targets, weighIns(80, 1.2), WINDOW_END, tooFewDays)!.deltaKcal,
    ).toBe(-100);
  });

  it("stays quiet when the pace is right", () => {
    // -0.5 kg/week on an 80 kg cut: not a stall, not too fast.
    expect(
      proposeDietAdaptation("lose_fat", targets, weighIns(80, -0.5), WINDOW_END, tooFewDays),
    ).toBeNull();
  });

  it("is the path taken when nothing was logged at all", () => {
    const p = proposeDietAdaptation("lose_fat", targets, weighIns(80, 0), WINDOW_END);
    expect(p!.reasonKey).toBe("adapt.cut_stall");
    expect(p!.observedTdee).toBeNull();
  });
});
