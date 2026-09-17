import { describe, expect, it } from "vitest";
import {
  isComplete,
  parseFunnelAnswers,
  serializeFunnelAnswers,
  toDietPrefill,
  type FunnelAnswers,
} from "./answers";

const COMPLETE: FunnelAnswers = {
  goal: "lose_fat",
  gender: "male",
  age: 30,
  heightCm: 178,
  weightKg: 92,
  targetWeightKg: 80,
  trainingDays: "3_4",
  activityLevel: "light",
  mealsPerDay: 4,
  experience: "returning",
  blocker: "what_to_eat",
};

describe("parseFunnelAnswers", () => {
  it("round-trips a complete set of answers", () => {
    expect(parseFunnelAnswers(serializeFunnelAnswers(COMPLETE))).toEqual(COMPLETE);
  });

  it("returns nothing for junk rather than throwing", () => {
    // This cookie is user-writable, so every one of these is a real request
    // shape, not a hypothetical.
    expect(parseFunnelAnswers(undefined)).toEqual({});
    expect(parseFunnelAnswers("")).toEqual({});
    expect(parseFunnelAnswers("not json")).toEqual({});
    expect(parseFunnelAnswers("[1,2,3]")).toEqual({});
    expect(parseFunnelAnswers("null")).toEqual({});
    expect(parseFunnelAnswers('"a string"')).toEqual({});
  });

  it("drops values outside the enum instead of trusting them", () => {
    const parsed = parseFunnelAnswers(
      JSON.stringify({ ...COMPLETE, goal: "get_shredded", gender: "other", activityLevel: "x" }),
    );
    expect(parsed.goal).toBeUndefined();
    expect(parsed.gender).toBeUndefined();
    expect(parsed.activityLevel).toBeUndefined();
    // …while everything valid alongside them survives.
    expect(parsed.weightKg).toBe(92);
  });

  it("drops numbers outside the plausible range", () => {
    const parsed = parseFunnelAnswers(
      JSON.stringify({ ...COMPLETE, age: 4, heightCm: 900, weightKg: -70 }),
    );
    expect(parsed.age).toBeUndefined();
    expect(parsed.heightCm).toBeUndefined();
    expect(parsed.weightKg).toBeUndefined();
    expect(parsed.targetWeightKg).toBe(80);
  });

  it("accepts numbers that arrive as strings", () => {
    // A hand-edited cookie, or an older serializer. Coercing is safe because
    // the range check runs afterwards either way.
    const parsed = parseFunnelAnswers(JSON.stringify({ ...COMPLETE, weightKg: "92.5" }));
    expect(parsed.weightKg).toBe(92.5);
  });

  it("keeps a partial answer set from an abandoned visit", () => {
    const parsed = parseFunnelAnswers(JSON.stringify({ goal: "build_muscle", age: 22 }));
    expect(parsed).toEqual({ goal: "build_muscle", age: 22 });
    expect(isComplete(parsed)).toBe(false);
  });

  it("only allows the three meal counts the plan builder supports", () => {
    expect(parseFunnelAnswers(JSON.stringify({ mealsPerDay: 4 })).mealsPerDay).toBe(4);
    expect(parseFunnelAnswers(JSON.stringify({ mealsPerDay: 9 })).mealsPerDay).toBeUndefined();
  });
});

describe("isComplete", () => {
  it("is true only when every question has an answer", () => {
    expect(isComplete(COMPLETE)).toBe(true);
    const missingOne: Partial<FunnelAnswers> = { ...COMPLETE };
    delete missingOne.blocker;
    expect(isComplete(missingOne)).toBe(false);
  });
});

describe("toDietPrefill", () => {
  it("hands the questionnaire the keys it shares, and nothing else", () => {
    const prefill = toDietPrefill(COMPLETE);
    expect(prefill).toEqual({
      goal: "lose_fat",
      gender: "male",
      age: 30,
      heightCm: 178,
      weightKg: 92,
      targetWeightKg: 80,
      activityLevel: "light",
      trainingDays: "3_4",
      mealsPerDay: "4",
    });
    // Funnel-only answers are not questionnaire fields and must not leak into
    // the wizard's answer object, where an unknown key would be submitted.
    expect(prefill).not.toHaveProperty("experience");
    expect(prefill).not.toHaveProperty("blocker");
  });

  it("carries mealsPerDay as the string the option cards compare against", () => {
    expect(toDietPrefill({ mealsPerDay: 5 }).mealsPerDay).toBe("5");
  });

  it("omits keys that were never answered rather than sending undefined", () => {
    expect(toDietPrefill({ goal: "maintain" })).toEqual({ goal: "maintain" });
  });
});
