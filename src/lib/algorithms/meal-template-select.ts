/**
 * Template selection — pick the single best pre-built daily template for the
 * user, then meal-template-fill.ts scales it to their macros. Scoring favors a
 * template whose budget and cooking effort match the questionnaire and whose
 * native proteins the user actually eats (fewer forced substitutions).
 */

import {
  isIngredientAllowed,
  type DietConstraints,
  type Ingredient,
  type TemplateSlot,
} from "./meal-template-fill";

export type MealTemplate = {
  id: string;
  cookingTier: "fast" | "normal" | "mealprep";
  budgetTier: "low" | "medium" | "high";
};

const BUDGET_RANK = { low: 0, medium: 1, high: 2 } as const;

export function scoreTemplate(
  template: MealTemplate,
  slots: TemplateSlot[],
  byId: Map<string, Ingredient>,
  c: DietConstraints,
): number {
  let score = 0;

  // Budget: never recommend something above the user's budget; reward a match.
  const tb = BUDGET_RANK[template.budgetTier];
  const ub = BUDGET_RANK[c.budgetLevel];
  score += tb > ub ? -3 * (tb - ub) : 1;

  // Protein fit: each native protein the user can eat as-authored is a win;
  // one the user must substitute away is a small cost.
  const proteinSlots = slots.filter((s) => s.role === "protein");
  for (const s of proteinSlots) {
    const ing = byId.get(s.ingredientId);
    if (!ing) continue;
    score += isIngredientAllowed(ing, c) ? 1 : -1;
  }

  return score;
}

/** Cooking preference bonus, applied on top of scoreTemplate. */
function cookingBonus(template: MealTemplate, cookingPref: string): number {
  if (cookingPref === "fast") return template.cookingTier === "fast" ? 2 : 0;
  if (cookingPref === "mealprep") return template.cookingTier !== "fast" ? 1 : 0;
  return 0;
}

export function selectTemplate(
  templates: MealTemplate[],
  slotsByTemplate: Map<string, TemplateSlot[]>,
  byId: Map<string, Ingredient>,
  c: DietConstraints,
  cookingPref: string,
): MealTemplate | null {
  let best: MealTemplate | null = null;
  let bestScore = -Infinity;

  for (const template of templates) {
    const slots = slotsByTemplate.get(template.id) ?? [];
    const score = scoreTemplate(template, slots, byId, c) + cookingBonus(template, cookingPref);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return best;
}
