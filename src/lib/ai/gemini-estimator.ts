import {
  ESTIMATE_SCHEMA,
  SYSTEM_PROMPT,
  normalizeItems,
  type MealEstimate,
  type RawEstimatedItem,
} from "@/lib/ai/estimate-shape";

/**
 * Gemini meal estimation, for evaluating it against Claude on real Tunisian
 * meals before committing to a provider.
 *
 * Uses the Interactions API (`/v1beta/interactions`) over plain fetch — the
 * older `models/{id}:generateContent` surface is marked legacy, and the REST
 * call is small enough that an SDK dependency would only add version drift.
 *
 * ⚠️ Google's FREE tier trains on submitted content and permits human review.
 * Tunisia is outside the EEA/UK/Swiss carve-out that applies paid-tier terms
 * to free usage, so real users' meal photos must not go through a free key.
 * Test with your own photos, or enable billing before pointing users at this.
 */

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

/**
 * Overridable so a bake-off can pin a different Gemini without a redeploy.
 *
 * NOT 2.5: `gemini-2.5-flash` and `-flash-lite` return 404 "no longer
 * available to new users" on both the interactions and generateContent
 * endpoints, even though /v1beta/models still lists them. Verified working on
 * a fresh key: gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite,
 * gemini-flash-latest. (gemini-3.5-flash was returning 503 overloaded.)
 */
function modelId(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

// Inline bytes cap the whole request at 20MB; the client downscale keeps us
// far below that, and the action already rejects anything over ~3MB.
type InputPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string };

/**
 * Real REST response shape, confirmed against the live API. Google's docs
 * describe an `output_text` convenience field — that is an SDK-level nicety
 * and is absent over REST. The generated text is inside `steps`, alongside
 * `thought` steps these models also emit.
 */
type InteractionResponse = {
  status?: string;
  output_text?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number };
};

/** Concatenates the text of every model_output step, in order. */
export function readOutputText(body: InteractionResponse): string {
  if (body.output_text) return body.output_text;
  return (body.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
}

export async function estimateWithGemini(input: {
  description: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp";
}): Promise<MealEstimate> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  // The Interactions API has no separately verified system-instruction field,
  // so the persona leads the input as text. Same words as the Claude path —
  // the comparison must isolate the model, not the prompt.
  const parts: InputPart[] = [
    { type: "text", text: SYSTEM_PROMPT },
    { type: "text", text: input.description.trim() || "Estimate the meal in this photo." },
  ];
  if (input.imageBase64 && input.imageMediaType) {
    parts.push({
      type: "image",
      data: input.imageBase64,
      mime_type: input.imageMediaType,
    });
  }

  const response = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    // Never cache: a new photo is a new request, and Next does not cache POST.
    cache: "no-store",
    body: JSON.stringify({
      model: modelId(),
      input: parts,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: ESTIMATE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    // Surface the status so a 429 (free-tier quota) is distinguishable from a
    // 400 (bad model id) in logs, instead of silently becoming a fallback.
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }

  const body = (await response.json()) as InteractionResponse;
  const outputText = readOutputText(body);
  if (!outputText) {
    throw new Error(`Gemini returned no model_output text (status=${body.status ?? "?"}).`);
  }

  const parsed = JSON.parse(outputText) as { items?: RawEstimatedItem[] };
  const items = normalizeItems(parsed.items);
  if (items.length === 0) throw new Error("Gemini detected no items.");

  return { items, simulated: false, provider: "gemini" };
}
