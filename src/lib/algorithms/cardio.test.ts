import { describe, expect, it } from "vitest";
import {
  caloriesBurned,
  cardioPlacement,
  cardioSchedule,
  defaultCardioMinutes,
  experienceOf,
  isValidCardioMinutes,
  suggestedCardioDayIds,
} from "./cardio";

describe("experienceOf", () => {
  it("reads the bucket out of the questionnaire's own option strings", () => {
    expect(experienceOf("Beginner (0-6 months)")).toBe("beginner");
    expect(experienceOf("Intermediate (6mo-2yrs)")).toBe("intermediate");
    expect(experienceOf("Advanced (2+ yrs)")).toBe("advanced");
  });

  it("falls back to beginner for anything it does not recognise", () => {
    expect(experienceOf(null)).toBe("beginner");
    expect(experienceOf("")).toBe("beginner");
    expect(experienceOf("who knows")).toBe("beginner");
  });
});

describe("cardioSchedule", () => {
  it("matches the sheet exactly", () => {
    expect(cardioSchedule("Beginner (0-6 months)")).toEqual({
      minPerWeek: 1,
      maxPerWeek: 1,
      minMinutes: 30,
      maxMinutes: 30,
    });
    expect(cardioSchedule("Intermediate (6mo-2yrs)")).toEqual({
      minPerWeek: 1,
      maxPerWeek: 2,
      minMinutes: 30,
      maxMinutes: 35,
    });
    expect(cardioSchedule("Advanced (2+ yrs)")).toEqual({
      minPerWeek: 2,
      maxPerWeek: 3,
      minMinutes: 35,
      maxMinutes: 45,
    });
  });

  it("proposes the short end of each range by default", () => {
    expect(defaultCardioMinutes("Beginner (0-6 months)")).toBe(30);
    expect(defaultCardioMinutes("Advanced (2+ yrs)")).toBe(35);
  });
});

describe("cardioPlacement", () => {
  it("prefers upper-body days", () => {
    for (const name of ["Push", "Pull", "Upper", "Upper Body"]) {
      expect(cardioPlacement(name)).toBe("preferred");
    }
  });

  it("discourages leg days", () => {
    for (const name of ["Legs", "Lower", "Lower Body"]) {
      expect(cardioPlacement(name)).toBe("discouraged");
    }
  });

  it("leaves full-body days neutral", () => {
    expect(cardioPlacement("Full Body A")).toBe("neutral");
    expect(cardioPlacement("Full Body")).toBe("neutral");
  });

  it("reads an Upper/Lower day as a leg day, not an upper one", () => {
    expect(cardioPlacement("Upper / Lower")).toBe("discouraged");
  });
});

describe("suggestedCardioDayIds", () => {
  // Male 4-day split: Pull, Push, Legs, Upper.
  const ppl = [
    { id: "d1", dayName: "Pull" },
    { id: "d2", dayName: "Push" },
    { id: "d3", dayName: "Legs" },
    { id: "d4", dayName: "Upper" },
  ];

  it("gives a beginner one day, and never a leg day", () => {
    expect(suggestedCardioDayIds(ppl, "Beginner (0-6 months)")).toEqual(["d1"]);
  });

  it("gives an advanced lifter two, both off the legs", () => {
    const picked = suggestedCardioDayIds(ppl, "Advanced (2+ yrs)");
    expect(picked).toHaveLength(2);
    expect(picked).not.toContain("d3");
  });

  it("falls back to neutral days when there are no preferred ones", () => {
    const fullBody = [
      { id: "a", dayName: "Full Body A" },
      { id: "b", dayName: "Full Body B" },
    ];
    expect(suggestedCardioDayIds(fullBody, "Beginner (0-6 months)")).toEqual(["a"]);
  });

  it("would rather suggest nothing than suggest a leg day", () => {
    const legsOnly = [
      { id: "x", dayName: "Legs" },
      { id: "y", dayName: "Lower" },
    ];
    expect(suggestedCardioDayIds(legsOnly, "Advanced (2+ yrs)")).toEqual([]);
  });
});

describe("caloriesBurned", () => {
  // MET x 3.5 x kg / 200 x minutes. Speed walking at 4.8 MET, 80 kg, 30 min:
  // 4.8 * 3.5 * 80 / 200 * 30 = 201.6 -> 202.
  it("applies the MET equation", () => {
    expect(caloriesBurned({ metValue: 4.8, weightKg: 80, minutes: 30 })).toBe(202);
  });

  // Rounded once, at the end — so double the input is 403 (round of 403.2),
  // not 404 (double the rounded 202).
  it("scales with bodyweight and with time", () => {
    expect(caloriesBurned({ metValue: 4.8, weightKg: 160, minutes: 30 })).toBe(403);
    expect(caloriesBurned({ metValue: 4.8, weightKg: 80, minutes: 60 })).toBe(403);
  });

  it("returns zero rather than NaN on missing inputs", () => {
    expect(caloriesBurned({ metValue: 0, weightKg: 80, minutes: 30 })).toBe(0);
    expect(caloriesBurned({ metValue: 4.8, weightKg: 0, minutes: 30 })).toBe(0);
    expect(caloriesBurned({ metValue: 4.8, weightKg: 80, minutes: 0 })).toBe(0);
    expect(caloriesBurned({ metValue: Number.NaN, weightKg: 80, minutes: 30 })).toBe(0);
  });
});

describe("isValidCardioMinutes", () => {
  it("agrees with the CHECK constraint on the table", () => {
    expect(isValidCardioMinutes(5)).toBe(true);
    expect(isValidCardioMinutes(120)).toBe(true);
    expect(isValidCardioMinutes(4)).toBe(false);
    expect(isValidCardioMinutes(121)).toBe(false);
    expect(isValidCardioMinutes(30.5)).toBe(false);
  });
});
