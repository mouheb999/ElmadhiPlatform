import { describe, expect, it } from "vitest";
import { formatServing, type ServingUnit } from "./servings";

const egg: ServingUnit = {
  unitEn: "egg",
  unitEnPlural: "eggs",
  unitAr: "بيضة",
  unitArPlural: "بيضات",
  unitGrams: 50,
};

const oil: ServingUnit = {
  unitEn: "tbsp",
  unitEnPlural: "tbsp",
  unitAr: "ملعقة كبيرة",
  unitArPlural: "ملاعق كبيرة",
  unitGrams: 10,
};

const rice: ServingUnit = {
  unitEn: null,
  unitEnPlural: null,
  unitAr: null,
  unitArPlural: null,
  unitGrams: null,
};

describe("formatServing", () => {
  it("counts whole units", () => {
    expect(formatServing("en", 100, egg)).toBe("2 eggs");
    expect(formatServing("en", 50, egg)).toBe("1 egg");
  });

  it("uses the singular only for exactly one", () => {
    expect(formatServing("tn", 50, egg)).toBe("1 بيضة");
    expect(formatServing("tn", 150, egg)).toBe("3 بيضات");
  });

  it("rounds to halves so the number stays readable", () => {
    expect(formatServing("en", 125, egg)).toBe("2½ eggs");
    expect(formatServing("en", 25, egg)).toBe("½ egg");
  });

  it("pluralizes the way each language actually does", () => {
    // English turns plural past one…
    expect(formatServing("en", 75, egg)).toBe("1½ eggs");
    // …Derja counts in whole things, so 1½ is still "بيضة ونص".
    expect(formatServing("tn", 75, egg)).toBe("1½ بيضة");
    expect(formatServing("tn", 100, egg)).toBe("2 بيضات");
  });

  it("rounds to whole units once the count gets large", () => {
    // 11.4 handfuls of anything is not a serving suggestion.
    expect(formatServing("en", 570, egg)).toBe("11 eggs");
  });

  it("stays silent when the amount is too small to name", () => {
    expect(formatServing("en", 3, egg)).toBeNull();
  });

  it("stays silent for foods served by weight", () => {
    expect(formatServing("en", 150, rice)).toBeNull();
  });

  it("handles measures whose plural is the same word", () => {
    expect(formatServing("en", 20, oil)).toBe("2 tbsp");
    expect(formatServing("tn", 10, oil)).toBe("1 ملعقة كبيرة");
    expect(formatServing("tn", 20, oil)).toBe("2 ملاعق كبيرة");
  });

  it("never divides by zero or reports a serving of nothing", () => {
    expect(formatServing("en", 0, egg)).toBeNull();
    expect(formatServing("en", 100, { ...egg, unitGrams: 0 })).toBeNull();
  });
});
