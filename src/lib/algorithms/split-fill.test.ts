import { describe, it, expect } from "vitest";
import { resolveEquipmentValues, isQuestionVisible } from "./split-fill";

// The slot-filling generator these tests used to cover was retired in migration
// 027 (programs are now copied from fixed_splits). Only the two questionnaire
// helpers remain here.

describe("isQuestionVisible", () => {
  it("shows a question with no shown_if", () => {
    expect(isQuestionVisible(null, {})).toBe(true);
  });

  it("hides equipment_gym for a home-only user", () => {
    const shownIf = { location: ["Gym only", "Home + Gym (hybrid)"] };
    expect(isQuestionVisible(shownIf, { location: "Home only" })).toBe(false);
    expect(isQuestionVisible(shownIf, { location: "Gym only" })).toBe(true);
    expect(isQuestionVisible(shownIf, { location: "Home + Gym (hybrid)" })).toBe(true);
  });

  it("shows both equipment questions for a hybrid user", () => {
    const gym = { location: ["Gym only", "Home + Gym (hybrid)"] };
    const home = { location: ["Home only", "Home + Gym (hybrid)"] };
    const answers = { location: "Home + Gym (hybrid)" };
    expect(isQuestionVisible(gym, answers)).toBe(true);
    expect(isQuestionVisible(home, answers)).toBe(true);
  });

  it("gates pregnancy_status behind gender", () => {
    const shownIf = { gender: ["Female"] };
    expect(isQuestionVisible(shownIf, { gender: "Male" })).toBe(false);
    expect(isQuestionVisible(shownIf, { gender: "Prefer not to say" })).toBe(false);
    expect(isQuestionVisible(shownIf, { gender: "Female" })).toBe(true);
  });

  it("stays hidden while the dependency is unanswered", () => {
    expect(isQuestionVisible({ location: ["Gym only"] }, {})).toBe(false);
  });

  it("ignores an array answer for a single-select dependency", () => {
    expect(isQuestionVisible({ location: ["Gym only"] }, { location: ["Gym only"] })).toBe(false);
  });
});

describe("resolveEquipmentValues", () => {
  const map = {
    Barbell: "barbell",
    Dumbbells: "dumbbell",
    "Cable machines": "cable",
    "Selectorized machines": "machine",
    Kettlebell: "kettlebell",
    "Resistance bands": "band",
    "Pull-up bar": "bodyweight",
    "Bodyweight only": "bodyweight",
  };

  it("uses only the gym answers for a gym-only user", () => {
    const out = resolveEquipmentValues(
      { location: "Gym only", equipment_gym: ["Barbell", "Cable machines"], equipment_home: ["Resistance bands"] },
      map,
    );
    expect(out.sort()).toEqual(["barbell", "bodyweight", "cable"]);
  });

  it("uses only the home answers for a home-only user", () => {
    const out = resolveEquipmentValues(
      { location: "Home only", equipment_gym: ["Barbell"], equipment_home: ["Dumbbells"] },
      map,
    );
    expect(out.sort()).toEqual(["bodyweight", "dumbbell"]);
  });

  it("unions both for a hybrid user", () => {
    const out = resolveEquipmentValues(
      { location: "Home + Gym (hybrid)", equipment_gym: ["Barbell"], equipment_home: ["Dumbbells"] },
      map,
    );
    expect(out.sort()).toEqual(["barbell", "bodyweight", "dumbbell"]);
  });

  it("always includes bodyweight even when nothing is ticked", () => {
    expect(resolveEquipmentValues({ location: "Home only", equipment_home: [] }, map)).toEqual(["bodyweight"]);
  });

  it("maps Pull-up bar onto bodyweight without duplicating it", () => {
    const out = resolveEquipmentValues(
      { location: "Home only", equipment_home: ["Pull-up bar", "Bodyweight only"] },
      map,
    );
    expect(out).toEqual(["bodyweight"]);
  });
});
