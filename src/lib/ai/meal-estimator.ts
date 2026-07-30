import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import { lookupNutrition } from "@/lib/ai/nutrition-lookup";
import { estimateWithGemini } from "@/lib/ai/gemini-estimator";
import {
  ESTIMATE_SCHEMA,
  SYSTEM_PROMPT,
  normalizeItems,
  type EstimatedItem,
  type MealEstimate,
  type RawEstimatedItem,
} from "@/lib/ai/estimate-shape";

type Supa = Awaited<ReturnType<typeof createClient>>;

// Re-exported so existing importers of "@/lib/ai/meal-estimator" keep working.
export type { EstimatedItem, MealEstimate, EstimateProvider } from "@/lib/ai/estimate-shape";

type EstimatorInput = {
  description: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp";
};

/**
 * Picks the model provider. MEAL_AI_PROVIDER wins when set, so a bake-off can
 * be switched without touching keys; otherwise whichever key is configured.
 * Returns null when no model is available at all — the grounded fallback runs.
 */
function selectProvider(): "claude" | "gemini" | null {
  const requested = process.env.MEAL_AI_PROVIDER?.trim().toLowerCase();
  if (requested === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (requested === "claude") return process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

/**
 * Provider-swappable meal estimation (the V3 "camera AI" architecture,
 * shipped early). A configured model estimates the meal; if none is set — or
 * the call fails — a deterministic fallback grounds the description against
 * the local catalog and USDA. Callers can't tell the difference except via
 * `provider` / `simulated`, so swapping providers never touches the UI.
 */
export async function estimateMeal(
  supabase: Supa,
  input: EstimatorInput,
): Promise<MealEstimate> {
  const provider = selectProvider();
  if (provider) {
    try {
      return provider === "gemini"
        ? await estimateWithGemini(input)
        : await estimateWithClaude(input);
    } catch (error) {
      // Model/API failure must never break the feature — degrade to fallback.
      // But never degrade *silently*: a revoked key, an unbilled project or a
      // dead model id all surface in the UI as a plausible-looking estimate,
      // so the only way to notice is a log line. The `provider` field on the
      // stored event is the after-the-fact record; this is the live one.
      console.error(`[meal-estimator] ${provider} failed, using fallback:`, error);
    }
  }
  return estimateSimulated(supabase, input.description);
}

/** Exported for the provider bake-off; the app goes through estimateMeal. */
export async function estimateWithClaude(input: EstimatorInput): Promise<MealEstimate> {
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

  const parsed = JSON.parse(textBlock.text) as { items?: RawEstimatedItem[] };
  const items = normalizeItems(parsed.items);

  if (items.length === 0) throw new Error("No items detected.");
  return { items, simulated: false, provider: "claude" };
}

/** Words that never name a food — dropped before lookup so they don't burn a
 *  rate-limited USDA call or match something absurd. */
const STOPWORDS = new Set([
  "with", "and", "the", "some", "plus", "for", "من", "مع",
  "ate", "had", "eating", "meal", "lunch", "dinner", "breakfast", "snack",
  "gram", "grams", "cup", "cups", "plate", "bowl", "piece", "pieces",
]);

const MAX_LOOKUP_TERMS = 4;
/** Portion assumed when nothing better is known. Stated, not hidden. */
const DEFAULT_PORTION_G = 150;

/**
 * Deterministic fallback used when no model is configured, or when the model
 * call fails. Each term is grounded against the local Tunisian ingredient
 * table and then USDA FoodData Central, so the macros are real even with no
 * LLM in the loop. Portion size is still assumed — hence the modest
 * confidence, and the UI keeps every field editable before anything is logged.
 */
async function estimateSimulated(supabase: Supa, description: string): Promise<MealEstimate> {
  const terms = [
    ...new Set(
      description
        .toLowerCase()
        .split(/[\s,،.+&/()]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t)),
    ),
  ].slice(0, MAX_LOOKUP_TERMS);

  // Terms are independent — look them up concurrently rather than serially.
  const facts = await Promise.all(terms.map((term) => lookupNutrition(supabase, term)));

  const items: EstimatedItem[] = [];
  const seen = new Set<string>();

  for (const fact of facts) {
    if (!fact || seen.has(fact.name)) continue;
    seen.add(fact.name);

    const grams = fact.typicalServingG ?? DEFAULT_PORTION_G;
    const factor = grams / 100;
    items.push({
      name: fact.name,
      quantityG: grams,
      calories: Math.round(fact.caloriesPer100g * factor),
      proteinG: Math.round(fact.proteinPer100g * factor),
      carbsG: Math.round(fact.carbsPer100g * factor),
      fatG: Math.round(fact.fatPer100g * factor),
      // A curated local row carries a real serving size; a USDA hit is the
      // right food with a guessed portion. Score them differently.
      confidence: fact.source === "local" ? 0.5 : 0.35,
    });
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

  return { items, simulated: true, provider: "fallback" };
}
