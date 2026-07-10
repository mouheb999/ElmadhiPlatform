import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

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

export type MealEstimate = {
  items: EstimatedItem[];
  /** True when produced by the DB-matching fallback, not a real model. */
  simulated: boolean;
};

/**
 * Provider-swappable meal estimation (the V3 "camera AI" architecture,
 * shipped early): if ANTHROPIC_API_KEY is configured, a Claude vision/text
 * call estimates the meal; otherwise a deterministic fallback matches the
 * description against the Tunisian foods catalog. Callers can't tell the
 * difference except via `simulated` — swapping providers never touches UI.
 */
export async function estimateMeal(
  supabase: Supa,
  input: {
    description: string;
    imageBase64?: string;
    imageMediaType?: "image/jpeg" | "image/png" | "image/webp";
  },
): Promise<MealEstimate> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await estimateWithClaude(input);
    } catch {
      // Model/API failure must never break the feature — degrade to fallback.
    }
  }
  return estimateSimulated(supabase, input.description);
}

const ESTIMATE_SCHEMA = {
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

const SYSTEM_PROMPT = `You are a nutritionist for a Tunisian fitness app. Estimate the calories and
macros of the meal the user describes and/or photographs. You know Tunisian
cuisine well (couscous, kafteji, lablabi, ojja, mlawi, brik, chorba...) and
typical Tunisian portion sizes. Break the meal into separate food items with a
realistic portion in grams and the macros for that whole portion. Be honest
with the confidence score: lower it when the portion is guessed from a vague
description or a hard-to-read photo. Reply with item names in the same
language the user used (Tunisian Arabic or English).`;

async function estimateWithClaude(input: {
  description: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp";
}): Promise<MealEstimate> {
  const client = new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.imageBase64 && input.imageMediaType) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.imageMediaType, data: input.imageBase64 },
    });
  }
  content.push({
    type: "text",
    text: input.description.trim() || "Estimate the meal in this photo.",
  });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: "json_schema", schema: ESTIMATE_SCHEMA },
    },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model declined the request.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty model response.");

  const parsed = JSON.parse(textBlock.text) as {
    items: {
      name: string;
      quantity_g: number;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      confidence: number;
    }[];
  };

  const items: EstimatedItem[] = (parsed.items ?? [])
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

  if (items.length === 0) throw new Error("No items detected.");
  return { items, simulated: false };
}

/**
 * Deterministic fallback: match description words against the foods catalog
 * and assume a default 150g portion per matched food. Low confidence by
 * design — the UI shows everything as editable before logging.
 */
async function estimateSimulated(supabase: Supa, description: string): Promise<MealEstimate> {
  const tokens = [
    ...new Set(
      description
        .split(/[\s,،.+&/]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3),
    ),
  ].slice(0, 6);

  const items: EstimatedItem[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const { data: foods } = await supabase
      .from("foods")
      .select("id, name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .or(`name_en.ilike.%${token}%,name_ar.ilike.%${token}%`)
      .limit(1);
    const food = foods?.[0];
    if (!food || seen.has(food.id)) continue;
    seen.add(food.id);

    const grams = 150;
    const factor = grams / 100;
    items.push({
      name: food.name_en ?? food.name_ar,
      quantityG: grams,
      calories: Math.round((food.calories_per_100g ?? 0) * factor),
      proteinG: Math.round((food.protein_per_100g ?? 0) * factor),
      carbsG: Math.round((food.carbs_per_100g ?? 0) * factor),
      fatG: Math.round((food.fat_per_100g ?? 0) * factor),
      confidence: 0.4,
    });
    if (items.length >= 5) break;
  }

  if (items.length === 0) {
    // Nothing matched — give the user an editable starting point, not a wall.
    items.push({
      name: description.trim().slice(0, 120) || "Meal",
      quantityG: 300,
      calories: 500,
      proteinG: 20,
      carbsG: 55,
      fatG: 20,
      confidence: 0.15,
    });
  }

  return { items, simulated: true };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
