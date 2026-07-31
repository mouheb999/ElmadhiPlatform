import type { Locale } from "@/lib/i18n";

/**
 * Household servings — "1 apple", "2 tbsp", "half a can".
 *
 * The plan is solved in grams and stays in grams: that is what hits the macro
 * target, and it is what the user edits. This layer only adds the sentence a
 * person can act on without a kitchen scale. Grams are always shown next to it,
 * so a rounded unit is a hint, never a claim of precision.
 *
 * Foods served by weight (rice, chicken, lentils) carry no unit and are left
 * alone — inventing "1 plate of rice" would be worse than the number.
 */
export type ServingUnit = {
  unitEn: string | null;
  unitEnPlural: string | null;
  unitAr: string | null;
  unitArPlural: string | null;
  /** Grams in one unit. Null for weight-only foods. */
  unitGrams: number | null;
};

/** Below this many units the name stops being useful — grams say it better. */
const MIN_UNITS = 0.375;

/** Above this, halves are noise: nobody serves 12½ olives. */
const WHOLE_ONLY_ABOVE = 10;

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** "1½", "2", "¾" — a count a person reads at a glance. */
function formatCount(count: number): string {
  const whole = Math.floor(count);
  const fraction = FRACTIONS[Number((count - whole).toFixed(2))];
  if (!fraction) return String(whole);
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

/**
 * The serving as a phrase ("2 eggs"), or null when this food has no unit or
 * the amount is too small to name. Never returns the grams — the caller shows
 * those, because they are the precise value and this is the approximation.
 */
export function formatServing(
  locale: Locale,
  quantityG: number,
  unit: ServingUnit,
): string | null {
  if (!unit.unitGrams || unit.unitGrams <= 0 || quantityG <= 0) return null;

  const raw = quantityG / unit.unitGrams;
  if (raw < MIN_UNITS) return null;

  const count =
    raw > WHOLE_ONLY_ABOVE ? Math.round(raw) : Math.max(0.5, Math.round(raw * 2) / 2);

  const singular = locale === "tn" ? unit.unitAr : unit.unitEn;
  const plural = locale === "tn" ? unit.unitArPlural : unit.unitEnPlural;
  // The two languages break differently, and both matter:
  //   English pluralizes anything past one — "½ egg" but "1½ eggs".
  //   Derja counts in whole things — "بيضة ونص", so 1½ keeps the singular and
  //   the plural starts at two ("زوز بيضات").
  const usePlural = locale === "tn" ? count >= 2 : count > 1;
  const word = (usePlural ? plural : singular) ?? singular;
  if (!word) return null;

  return `${formatCount(count)} ${word}`;
}
