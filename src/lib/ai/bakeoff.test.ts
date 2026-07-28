import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { estimateWithGemini } from "./gemini-estimator";
import { estimateWithClaude } from "./meal-estimator";
import type { MealEstimate } from "./estimate-shape";

// Vitest doesn't read .env.local — load it so the keys are visible here.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch {
  // No .env.local — rely on whatever is already in the environment.
}

/**
 * Provider bake-off. Not a pass/fail test — it prints a comparison table so
 * you can judge Claude vs Gemini on real Tunisian dishes. Skipped by default
 * so it never runs in CI or spends money unasked.
 *
 *   MEAL_AI_BAKEOFF=1 npx vitest run src/lib/ai/bakeoff.test.ts
 *
 * Needs GEMINI_API_KEY and/or ANTHROPIC_API_KEY. Whichever is missing is
 * reported as skipped rather than failing the run.
 */
const enabled = process.env.MEAL_AI_BAKEOFF === "1" ? describe : describe.skip;

/** Dishes chosen because a Western-trained food classifier fails on them. */
const DISHES = [
  "كسكسي بالعلوش",
  "lablabi with a poached egg and olive oil",
  "بريك بالتن والبيضة",
  "ojja merguez with two eggs",
  "kafteji with a side of bread",
  "mlawi with tuna and harissa",
];

type Row = { dish: string; provider: string; ms: number; kcal: number; summary: string };

function summarize(dish: string, provider: string, ms: number, e: MealEstimate): Row {
  const kcal = e.items.reduce((sum, i) => sum + i.calories, 0);
  const summary = e.items.map((i) => `${i.name} ${i.quantityG}g/${i.calories}kcal`).join(" + ");
  return { dish, provider, ms, kcal, summary };
}

async function timed(fn: () => Promise<MealEstimate>): Promise<[MealEstimate, number]> {
  const started = Date.now();
  const result = await fn();
  return [result, Date.now() - started];
}

enabled("meal AI bake-off", () => {
  it(
    "compares providers on Tunisian dishes",
    async () => {
      const rows: Row[] = [];

      for (const dish of DISHES) {
        if (process.env.GEMINI_API_KEY) {
          try {
            const [estimate, ms] = await timed(() => estimateWithGemini({ description: dish }));
            rows.push(summarize(dish, `gemini:${process.env.GEMINI_MODEL ?? "2.5-flash"}`, ms, estimate));
          } catch (error) {
            rows.push({ dish, provider: "gemini", ms: 0, kcal: 0, summary: `FAILED — ${error}` });
          }
        }
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            const [estimate, ms] = await timed(() => estimateWithClaude({ description: dish }));
            rows.push(summarize(dish, "claude:opus-4-8", ms, estimate));
          } catch (error) {
            rows.push({ dish, provider: "claude", ms: 0, kcal: 0, summary: `FAILED — ${error}` });
          }
        }
      }

      if (rows.length === 0) {
        console.log("\nNo provider key set — nothing to compare.\n");
        return;
      }

      console.log("\n=== Meal AI bake-off ===\n");
      for (const dish of DISHES) {
        const forDish = rows.filter((r) => r.dish === dish);
        if (forDish.length === 0) continue;
        console.log(dish);
        for (const row of forDish) {
          console.log(`  ${row.provider.padEnd(22)} ${String(row.ms).padStart(5)}ms  ${String(row.kcal).padStart(5)} kcal  ${row.summary}`);
        }
        console.log("");
      }
      console.log("Judge: are the dishes identified correctly, and are the");
      console.log("portions plausible for a Tunisian plate?\n");
      console.log("Note: gemini 2.5 is unavailable to new API keys (404), so");
      console.log("this runs on a 3.x flash model — price it from the Gemini");
      console.log("pricing page for whatever GEMINI_MODEL is set to, not from");
      console.log("2.5 numbers. Set ANTHROPIC_API_KEY to compare with Claude.\n");
    },
    // Six dishes x up to two providers, sequential — allow a generous ceiling.
    300_000,
  );
});
