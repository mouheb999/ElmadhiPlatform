/**
 * The contract every meal-estimation provider speaks: one JSON schema, one
 * system prompt, one normalizer. Providers differ only in transport, so a
 * bake-off compares models rather than prompt variations.
 *
 * No provider SDK is imported here — client components type-import from this
 * module without dragging a server SDK into the bundle.
 */

export type EstimatedItem = {
  name: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** 0..1 — recognition/estimation confidence. */
  confidence: number;
};

/** Which path produced an estimate. Recorded so a bake-off has real data. */
export type EstimateProvider = "claude" | "gemini" | "fallback";

export type MealEstimate = {
  items: EstimatedItem[];
  /** True when produced by the grounded lookup fallback, not a model. */
  simulated: boolean;
  provider: EstimateProvider;
};

/** Shared by both providers — Anthropic and Gemini both take JSON Schema. */
export const ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Food name in the user's language" },
          quantity_g: { type: "number", description: "Estimated portion in grams" },
          calories: { type: "number", description: "kcal for the whole portion" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          confidence: { type: "number", description: "0 to 1" },
        },
        required: ["name", "quantity_g", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You are a nutritionist for a Tunisian fitness app. Estimate the calories and
macros of the meal the user describes and/or photographs. You know Tunisian
cuisine well (couscous, kafteji, lablabi, ojja, mlawi, brik, chorba...) and
typical Tunisian portion sizes. Break the meal into separate food items with a
realistic portion in grams and the macros for that whole portion. Be honest
with the confidence score: lower it when the portion is guessed from a vague
description or a hard-to-read photo. Reply with item names in the same
language the user used (Tunisian Arabic or English).`;

/** Raw per-item shape as it comes back from either model. */
export type RawEstimatedItem = {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
};

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Bounds whatever the model returned. A model is free to emit a 40,000 kcal
 * item; the diary is not. Applied identically to every provider so one can't
 * look better than another by being clamped differently.
 */
export function normalizeItems(raw: RawEstimatedItem[] | undefined): EstimatedItem[] {
  return (raw ?? [])
    .filter((i) => Number.isFinite(i.calories) && i.calories >= 0)
    .slice(0, 10)
    .map((i) => ({
      name: String(i.name).slice(0, 120),
      quantityG: clamp(Math.round(i.quantity_g), 1, 3000),
      calories: clamp(Math.round(i.calories), 0, 5000),
      proteinG: clamp(Math.round(i.protein_g), 0, 500),
      carbsG: clamp(Math.round(i.carbs_g), 0, 1000),
      fatG: clamp(Math.round(i.fat_g), 0, 500),
      confidence: clamp(i.confidence, 0, 1),
    }));
}
