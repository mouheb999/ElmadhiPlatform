import { describe, expect, it } from "vitest";
import { pickBestMatch, type UsdaFood } from "./nutrition-lookup";

// Shapes copied from real /foods/search responses (dataType=Foundation,SR Legacy).
// USDA's own relevance ranking puts the wrong row first for short queries —
// these fixtures are the actual failures that motivated the re-ranker.
const ENERGY = 1008;

function food(description: string, kcal: number | undefined): UsdaFood {
  return {
    description,
    foodNutrients: kcal === undefined ? [] : [{ nutrientId: ENERGY, value: kcal }],
  };
}

describe("pickBestMatch", () => {
  it("skips the lunchmeat USDA ranks first for 'chicken breast'", () => {
    const results = [
      food("Lunchmeat, chicken breast, sliced", 0),
      food("Chicken, breast, meat only, cooked, roasted", 165),
    ];
    expect(pickBestMatch(results, "chicken breast")?.description).toBe(
      "Chicken, breast, meat only, cooked, roasted",
    );
  });

  it("prefers the head-position match over a blended oil", () => {
    const results = [
      food("Oil, corn, peanut, and olive", 884),
      food("Olive oil, extra virgin", 884),
    ];
    expect(pickBestMatch(results, "olive oil")?.description).toBe("Olive oil, extra virgin");
  });

  // Both descriptions have the head "couscous", so USDA's own relevance order
  // breaks the tie. This is load-bearing: dry couscous is 376 kcal/100g and
  // cooked is 112 — a 3.4x swing on the same name. The re-ranker deliberately
  // does not try to guess between them; disambiguating dry vs cooked is the
  // model's job (it sees the photo/description), not this lookup's.
  it("keeps USDA's ordering among equally-good head matches", () => {
    const results = [
      food("Couscous, cooked, enriched, with salt", 112),
      food("Couscous", 376),
    ];
    expect(pickBestMatch(results, "couscous")?.description).toBe(
      "Couscous, cooked, enriched, with salt",
    );
  });

  it("drops rows with a zero energy value rather than logging 0 kcal", () => {
    const results = [food("Lunchmeat, chicken breast, sliced", 0), food("Chicken, breast", 165)];
    expect(pickBestMatch(results, "nothing matches this")?.description).toBe("Chicken, breast");
  });

  it("returns null when every candidate lacks an energy value", () => {
    expect(pickBestMatch([food("Something, odd", 0), food("Other", undefined)], "x")).toBeNull();
  });

  it("returns null on an empty result set", () => {
    expect(pickBestMatch([], "couscous")).toBeNull();
  });

  it("falls back to USDA's own top usable row when nothing matches by name", () => {
    const results = [food("Semolina, unenriched", 360), food("Wheat flour", 364)];
    expect(pickBestMatch(results, "couscous")?.description).toBe("Semolina, unenriched");
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const results = [food("Tuna, fresh, bluefin, raw", 144)];
    expect(pickBestMatch(results, "  TUNA  ")?.description).toBe("Tuna, fresh, bluefin, raw");
  });
});
