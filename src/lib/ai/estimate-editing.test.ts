import { describe, expect, it } from "vitest";
import { toDraftItem, toLoggedItem, withNutrient, withQuantity } from "./estimate-editing";
import { t } from "@/lib/i18n";
import type { EstimatedItem } from "@/lib/ai/estimate-shape";

/**
 * The AI hands back a portion *and* the nutrients for that portion. Those two
 * used to be five independent number fields: doubling the grams left the
 * calories exactly where the model put them, so the logged meal was whatever
 * the user last saw rather than what they said they ate. The portion is now
 * the master control, and these are the cases that has to survive.
 */
const CHICKEN: EstimatedItem = {
  name: "Grilled chicken breast",
  quantityG: 200,
  calories: 330,
  proteinG: 62,
  carbsG: 0,
  fatG: 7,
  confidence: 0.8,
};

describe("withQuantity", () => {
  it("scales every nutrient with the portion", () => {
    const doubled = withQuantity(toDraftItem(CHICKEN), 400);
    expect(doubled.quantityG).toBe(400);
    expect(doubled.calories).toBeCloseTo(660);
    expect(doubled.proteinG).toBeCloseTo(124);
    expect(doubled.fatG).toBeCloseTo(14);
  });

  it("scales down as well as up", () => {
    const half = withQuantity(toDraftItem(CHICKEN), 100);
    expect(half.calories).toBeCloseTo(165);
    expect(half.proteinG).toBeCloseTo(31);
  });

  it("does not drift when the portion is nudged up and back down", () => {
    const item = toDraftItem(CHICKEN);
    let nudged = item;
    for (let i = 0; i < 8; i++) nudged = withQuantity(nudged, nudged.quantityG + 10);
    for (let i = 0; i < 8; i++) nudged = withQuantity(nudged, nudged.quantityG - 10);
    expect(nudged.quantityG).toBe(200);
    expect(nudged.calories).toBeCloseTo(CHICKEN.calories);
    expect(nudged.proteinG).toBeCloseTo(CHICKEN.proteinG);
  });

  it("keeps the nutrients while the field is momentarily empty", () => {
    // Clearing the input reports 0 — that is a typing state, not a zero meal.
    const cleared = withQuantity(toDraftItem(CHICKEN), 0);
    expect(cleared.quantityG).toBe(0);
    expect(cleared.calories).toBe(330);

    // ...and retyping a portion picks the scaling straight back up.
    expect(withQuantity(cleared, 300).calories).toBeCloseTo(495);
  });

  it("survives an estimate that arrived with no portion at all", () => {
    const zero = toDraftItem({ ...CHICKEN, quantityG: 0 });
    expect(withQuantity(zero, 100).calories).toBeCloseTo(330);
  });
});

describe("withNutrient", () => {
  it("keeps a hand-corrected value exactly as typed", () => {
    const corrected = withNutrient(toDraftItem(CHICKEN), "calories", 400);
    expect(corrected.calories).toBe(400);
    expect(corrected.quantityG).toBe(200);
    expect(corrected.proteinG).toBe(62);
  });

  it("makes the correction the basis of later portion changes", () => {
    const corrected = withNutrient(toDraftItem(CHICKEN), "calories", 400);
    // 400 kcal at 200g, so half the portion is 200 kcal — not half of the
    // model's original 330.
    expect(withQuantity(corrected, 100).calories).toBeCloseTo(200);
  });
});

describe("toLoggedItem", () => {
  it("sends the diary only the fields it stores", () => {
    const edited = withQuantity(toDraftItem(CHICKEN), 250);
    expect(Object.keys(toLoggedItem(edited)).sort()).toEqual(
      ["calories", "carbsG", "confidence", "fatG", "name", "proteinG", "quantityG"],
    );
    expect(toLoggedItem(edited).calories).toBeCloseTo(412.5);
  });
});

describe("result-editor copy", () => {
  it("names every macro in full in both locales", () => {
    const keys = [
      "diary.macro_protein", "diary.macro_carbs", "diary.macro_fat",
      "diary.quick_calories", "ai.quantity", "ai.qty_sync_hint",
      "ai.decrease", "ai.increase", "ai.remove_item",
    ] as const;
    for (const key of keys) {
      const en = t("en", key);
      const tn = t("tn", key);
      expect(en.length, `${key} en`).toBeGreaterThan(1);
      expect(tn.length, `${key} tn`).toBeGreaterThan(1);
      expect(tn, `${key} is untranslated`).not.toBe(en);
    }
  });
});
