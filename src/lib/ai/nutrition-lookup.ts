import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Grounded per-100g nutrition for a single food term.
 *
 * The estimator's weakest link is that a language model recalls macros from
 * memory. This module replaces that recall with a lookup: the local Tunisian
 * ingredient table first (39 curated rows, Arabic names, real serving sizes),
 * then USDA FoodData Central for everything else — a free government database
 * of ~600k foods. Portion size is still estimated; the macros no longer are.
 */
export type NutritionFacts = {
  source: "local" | "usda";
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  /** Curated locally; null from USDA, which has no portion concept here. */
  typicalServingG: number | null;
};

const USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";

// FoodData Central `nutrientId` values — the modern stable identifiers.
// NOT `nutrientNumber`, which is the legacy code for the same nutrient
// (energy is id 1008 but number "208"). Energy is also listed twice, in kJ
// (id 1062) and kcal (id 1008), so keying on id avoids a unit mix-up.
const NUTRIENT = { energyKcal: 1008, protein: 1003, fat: 1004, carbs: 1005 } as const;

// Foundation and SR Legacy report per 100g. Branded foods report per serving
// with a separate servingSize field, so excluding them keeps the math honest.
const PER_100G_DATATYPES = ["Foundation", "SR Legacy"];

// Nutrition facts don't change. Cache hard — the free tier allows 1,000
// requests/hour (30/hour on DEMO_KEY), and repeat foods dominate real usage.
const CACHE_SECONDS = 60 * 60 * 24 * 30;

/**
 * DEMO_KEY works with no signup at 30 requests/hour, which is enough to try
 * the feature but not to run it. Set USDA_FDC_API_KEY (free, instant, from
 * api.data.gov) for the 1,000/hour limit.
 */
function usdaKey(): string {
  return process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY";
}

export async function lookupNutrition(
  supabase: Supa,
  term: string,
): Promise<NutritionFacts | null> {
  const cleaned = term.trim();
  if (cleaned.length < 2) return null;

  const local = await lookupLocal(supabase, cleaned);
  if (local) return local;

  return lookupUsda(cleaned);
}

/** Curated Tunisian ingredients — matches Arabic or English, no network call. */
async function lookupLocal(supabase: Supa, term: string): Promise<NutritionFacts | null> {
  // Escape PostgREST's `or` filter delimiters so a comma or paren in the term
  // can't break out of the filter expression.
  const safe = term.replace(/[,()*]/g, " ").trim();
  if (!safe) return null;

  const { data } = await supabase
    .from("nutrition_ingredients")
    .select(
      "name_en, name_ar, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, typical_serving_g",
    )
    .or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%`)
    .limit(1);

  const row = data?.[0];
  if (!row) return null;

  return {
    source: "local",
    name: row.name_en ?? row.name_ar ?? term,
    caloriesPer100g: row.calories_per_100g ?? 0,
    proteinPer100g: row.protein_per_100g ?? 0,
    carbsPer100g: row.carbs_per_100g ?? 0,
    fatPer100g: row.fat_per_100g ?? 0,
    typicalServingG: row.typical_serving_g ?? null,
  };
}

type UsdaNutrient = { nutrientId?: number; value?: number };
export type UsdaFood = { description?: string; foodNutrients?: UsdaNutrient[] };

/**
 * USDA ranks by its own relevance score, which is weak for short queries —
 * "chicken breast" returns sliced lunchmeat, "olive oil" returns a corn/
 * peanut/olive blend. Pulling several candidates costs the same one request,
 * so re-rank them here:
 *
 *  - drop rows with no energy value (some SR Legacy rows carry zeros, which
 *    would otherwise log a confident 0 kcal);
 *  - prefer a description that *starts* with the search term, since USDA
 *    writes them head-first ("Couscous, cooked", "Oil, olive, salad or
 *    cooking") — a leading match is the food itself, a buried one is usually
 *    a compound or a processed derivative.
 */
export function pickBestMatch(foods: UsdaFood[], term: string): UsdaFood | null {
  const usable = foods.filter((food) => {
    const kcal = food.foodNutrients?.find((n) => n.nutrientId === NUTRIENT.energyKcal)?.value;
    return typeof kcal === "number" && Number.isFinite(kcal) && kcal > 0;
  });
  if (usable.length === 0) return null;

  const needle = term.toLowerCase().trim();
  const head = (food: UsdaFood) => (food.description ?? "").toLowerCase().split(",")[0].trim();

  return (
    usable.find((food) => head(food) === needle) ??
    usable.find((food) => head(food).includes(needle)) ??
    usable[0]
  );
}

/** USDA FoodData Central. Free; never throws — a miss degrades, not breaks. */
async function lookupUsda(term: string): Promise<NutritionFacts | null> {
  const url = new URL(USDA_SEARCH);
  url.searchParams.set("api_key", usdaKey());
  url.searchParams.set("query", term);
  // Several candidates cost the same single request; pickBestMatch re-ranks.
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("dataType", PER_100G_DATATYPES.join(","));

  try {
    // This runs inside a server action (after request-time APIs), where Next
    // does not cache by default — opt in explicitly.
    const response = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { foods?: UsdaFood[] };
    const food = pickBestMatch(body.foods ?? [], term);
    if (!food) return null;

    const read = (nutrientId: number) =>
      food.foodNutrients?.find((n) => n.nutrientId === nutrientId)?.value ?? 0;

    return {
      source: "usda",
      name: food.description?.toLowerCase() ?? term,
      caloriesPer100g: read(NUTRIENT.energyKcal),
      proteinPer100g: read(NUTRIENT.protein),
      carbsPer100g: read(NUTRIENT.carbs),
      fatPer100g: read(NUTRIENT.fat),
      typicalServingG: null,
    };
  } catch {
    // Network failure, rate limit, malformed payload — all degrade to a miss.
    return null;
  }
}
