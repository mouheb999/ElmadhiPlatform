import { describe, expect, it } from "vitest";
import { pickBestMatch, type UsdaFood } from "./nutrition-lookup";

/**
 * Live contract check against USDA FoodData Central. Skipped unless
 * RUN_LIVE_USDA=1 so CI never depends on a third party or burns rate limit:
 *   RUN_LIVE_USDA=1 npx vitest run src/lib/ai/live-usda.test.ts
 */
const live = process.env.RUN_LIVE_USDA === "1" ? describe : describe.skip;

const ENERGY = 1008;

live("USDA live contract", () => {
  it("returns per-100g macros for a real query", async () => {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY");
    url.searchParams.set("query", "couscous");
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("dataType", "Foundation,SR Legacy");

    const response = await fetch(url);
    expect(response.ok, `HTTP ${response.status} — rate limited?`).toBe(true);

    const body = (await response.json()) as { foods?: UsdaFood[] };
    const match = pickBestMatch(body.foods ?? [], "couscous");

    expect(match).not.toBeNull();
    // The shape this module depends on: nutrientId (not nutrientNumber).
    const kcal = match!.foodNutrients?.find((n) => n.nutrientId === ENERGY)?.value;
    expect(typeof kcal).toBe("number");
    expect(kcal).toBeGreaterThan(0);
    console.log(`  live: "${match!.description}" -> ${kcal} kcal/100g`);
  }, 30_000);
});
