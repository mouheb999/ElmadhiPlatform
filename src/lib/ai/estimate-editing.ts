/**
 * Editing rules for an AI meal estimate, kept out of the client component so
 * they can be tested (and so the component file stays a pure React module).
 *
 * The model returns a portion *and* the nutrients for that portion. Those used
 * to be independent fields in the UI: doubling the grams left the calories
 * exactly where the model put them, so what got logged was whatever the user
 * last saw rather than what they said they ate. The portion is the master
 * control here — everything else is derived from a per-100g spine.
 */
import type { EstimatedItem } from "@/lib/ai/estimate-shape";

export type NutrientKey = "calories" | "proteinG" | "carbsG" | "fatG";

const NUTRIENT_KEYS: NutrientKey[] = ["calories", "proteinG", "carbsG", "fatG"];

/** Upper bounds, mirroring the ones the estimator and the log action enforce. */
export const MAX_VALUE = {
  quantityG: 3000,
  calories: 5000,
  proteinG: 500,
  carbsG: 1000,
  fatG: 500,
} as const;

/**
 * One editable result row.
 *
 * `per100` is what keeps grams and nutrients honest: every quantity edit
 * recomputes the four numbers from it instead of leaving whatever the model
 * first said. Editing a nutrient directly rewrites the spine, so the next
 * quantity change scales from the user's correction rather than the estimate.
 *
 * Values are kept unrounded and rounded only for display — otherwise nudging
 * the portion up and back down would bleed a gram on every tap.
 */
export type DraftItem = EstimatedItem & {
  id: string;
  per100: Record<NutrientKey, number>;
};

let draftSeq = 0;

export function toDraftItem(item: EstimatedItem): DraftItem {
  // A zero-gram estimate can't be normalized per 100g; treat it as 100g so the
  // spine is at least defined, and let the first real quantity edit fix it.
  const factor = item.quantityG > 0 ? 100 / item.quantityG : 1;
  const per100 = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) per100[key] = item[key] * factor;
  return { ...item, id: `ai-item-${draftSeq++}`, per100 };
}

/** Re-portions an item: the four nutrients are recomputed from its spine. */
export function withQuantity(item: DraftItem, quantityG: number): DraftItem {
  // Mid-typing the field can legitimately read 0; keep the nutrients as they
  // were rather than collapsing them to zero and losing the estimate.
  if (quantityG <= 0) return { ...item, quantityG };
  const factor = quantityG / 100;
  const next = { ...item, quantityG };
  for (const key of NUTRIENT_KEYS) next[key] = item.per100[key] * factor;
  return next;
}

/** A hand-corrected nutrient becomes the new per-100g truth for this food. */
export function withNutrient(item: DraftItem, key: NutrientKey, value: number): DraftItem {
  return {
    ...item,
    [key]: value,
    per100:
      item.quantityG > 0
        ? { ...item.per100, [key]: (value * 100) / item.quantityG }
        : item.per100,
  };
}

/** Strips the local-only editing fields before the estimate is logged. */
export function toLoggedItem(item: DraftItem): EstimatedItem {
  return {
    name: item.name,
    quantityG: item.quantityG,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    confidence: item.confidence,
  };
}
