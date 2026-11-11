import { describe, expect, it } from "vitest";
import { calculateFitnessPlan } from "@/lib/funnel/fitness-plan";
import { expectedKgAt, journeyProgress, stopReached, type Journey } from "./journey";

function journeyAt(days: number, goal: "lose_fat" | "build_muscle" = "lose_fat"): Journey {
  const startAt = Date.UTC(2026, 9, 9);
  const cut = goal === "lose_fat";
  const plan = calculateFitnessPlan({
    goal,
    gender: "male",
    age: 27,
    heightCm: 176,
    weightKg: cut ? 88 : 68,
    targetWeightKg: cut ? 78 : 76,
    activityLevel: "moderate",
    trainingDays: "3_4",
    startAt,
  });
  return {
    plan,
    startAt,
    elapsedWeeks: Math.floor(days / 7),
    elapsedDays: days,
    startKg: cut ? 88 : 68,
    targetKg: cut ? 78 : 76,
  };
}

describe("the plan's pace", () => {
  it("starts at the start weight and ends at the twelve-week stop", () => {
    const { plan } = journeyAt(0);
    expect(expectedKgAt(plan, 0)).toBe(plan.timeline[0].kg);
    expect(expectedKgAt(plan, 84)).toBe(plan.timeline[3].kg);
    expect(expectedKgAt(plan, 400)).toBe(plan.timeline[3].kg);
  });

  it("runs a straight line between two stops", () => {
    const { plan } = journeyAt(0);
    const halfway = (plan.timeline[0].kg + plan.timeline[1].kg) / 2;
    expect(expectedKgAt(plan, 14)).toBeCloseTo(halfway, 6);
  });
});

describe("the scale against the plan", () => {
  it("fills the bar with what the scale delivered, not with days gone by", () => {
    const journey = journeyAt(35);
    // Five weeks in and not a gram lost: the calendar has moved, the bar has not.
    const idle = journeyProgress(journey, 88)!;
    expect(idle.percent).toBe(0);
    expect(idle.planPercent).toBeGreaterThan(30);
    expect(idle.status).toBe("behind");

    const half = journeyProgress(journey, 88 + idle.goalDeltaKg / 2)!;
    expect(half.percent).toBeCloseTo(50, 5);
  });

  it("calls half a kilo either side of the plan on track", () => {
    const journey = journeyAt(35);
    const expected = expectedKgAt(journey.plan, 35);
    expect(journeyProgress(journey, expected)!.status).toBe("on_track");
    expect(journeyProgress(journey, expected + 0.4)!.status).toBe("on_track");
    expect(journeyProgress(journey, expected - 0.4)!.status).toBe("on_track");
    const ahead = journeyProgress(journey, expected - 1.2)!;
    expect(ahead.status).toBe("ahead");
    expect(ahead.gapKg).toBeCloseTo(1.2, 5);
    const behind = journeyProgress(journey, expected + 1.2)!;
    expect(behind.status).toBe("behind");
    expect(behind.gapKg).toBeCloseTo(1.2, 5);
  });

  it("never runs the bar past its ends", () => {
    const journey = journeyAt(35);
    expect(journeyProgress(journey, 95)!.percent).toBe(0);
    expect(journeyProgress(journey, 60)!.percent).toBe(100);
  });

  it("reads a gain the right way round", () => {
    const journey = journeyAt(35, "build_muscle");
    const expected = expectedKgAt(journey.plan, 35);
    expect(journey.plan.direction).toBe("up");
    // Heavier than the plan is ahead on a gain, and lighter is behind.
    expect(journeyProgress(journey, expected + 1)!.status).toBe("ahead");
    expect(journeyProgress(journey, expected - 1)!.status).toBe("behind");
    expect(journeyProgress(journey, 68)!.percent).toBe(0);
  });
});

describe("reaching a stop", () => {
  const stop = { week: 4, lowKg: 85, highKg: 86 };

  it("ticks a stop once the scale is inside its band", () => {
    expect(stopReached(stop, 86.4, "down")).toBe(false);
    expect(stopReached(stop, 86, "down")).toBe(true);
    expect(stopReached(stop, 84, "down")).toBe(true);
    expect(stopReached(stop, 84.6, "up")).toBe(false);
    expect(stopReached(stop, 85, "up")).toBe(true);
  });

  it("always counts the start as reached", () => {
    expect(stopReached({ week: 0, lowKg: 88, highKg: 88 }, 99, "down")).toBe(true);
  });
});
