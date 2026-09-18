/**
 * How a calorie budget is divided into protein, fat and carbohydrate.
 *
 * ## Why this is its own file
 *
 * The calorie target is decided by `energy.ts` and is NOT NEGOTIABLE here.
 * Nothing in this module may change it. That separation is the architectural
 * rule the whole design rests on:
 *
 *     energy.ts        →  calorie target   (what to eat)
 *     macro-allocation →  protein/fat/carb (what it is made of)
 *
 * Previously the split was computed inline in `macros.ts` as a sequence of
 * "prescribe this, then rescue that": protein at a flat g/kg, fat at a flat
 * g/kg, carbohydrate whatever survived, and a floor to catch the wreckage. That
 * shape produces arithmetically valid, practically absurd plans — a 2,130 kcal
 * target split as 222 g protein, 86 g carbs, 100 g fat — because nothing in it
 * ever asked whether the RESULT was a sensible diet. It only asked whether each
 * macro got its own number.
 *
 * ## The policy
 *
 * Every bound is a named constant in POLICY below. There are no numeric
 * literals in the solver. Each bound is either a health floor, a practical
 * ceiling, or a quality preference, and the solver knows which is which —
 * because that ordering is what it relaxes along when a budget is too tight to
 * satisfy everything at once.
 *
 * Bounds come in two flavours deliberately:
 *
 *   - **per kg of reference weight** — what a BODY needs. A big frame needs
 *     more protein than a small one.
 *   - **as a share of calories** — what a DIET should look like. This is the
 *     half that was missing, and its absence is the whole bug: protein at
 *     2.0 g/kg of a 111 kg frame is 222 g, which is 42% of a 2,130 kcal budget.
 *     Defensible per kilo, indefensible as a diet.
 *
 * A macro must satisfy BOTH. That is what makes the absurd split impossible in
 * general rather than by special case.
 *
 * ## Priority
 *
 * When a budget cannot satisfy every bound at once, the solver relaxes in the
 * order given by `RELAXATION_ORDER` — never silently, always recorded on the
 * result, and it reports `feasible: false` rather than inventing a plan that
 * violates the policy.
 */

import { KCAL_PER_G_CARBS, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN } from "./macros-core";

/**
 * Every bound in the system, with the reason it exists.
 *
 * Changing a number here changes the product's nutrition policy, and the tests
 * assert against these constants rather than against copies of them — so a
 * deliberate change moves the tests with it, and an accidental one does not
 * slip through.
 */
export const POLICY = {
  protein: {
    /**
     * Health floor. Below roughly this, a deficit stops protecting muscle.
     * Never relaxed.
     */
    minPerKg: 1.2,
    /**
     * Practical ceiling per kilo. Intakes past ~2 g/kg show no further benefit
     * for body composition; more is simply displacing the carbohydrate that
     * fuels the training.
     */
    maxPerKg: 2.0,
    /**
     * Absolute ceiling in grams, regardless of frame.
     *
     * This is the bound the old system did not have, and its absence is what
     * let a 111 kg / 201 cm user be prescribed 222 g. 2.0 g/kg is a sensible
     * RATE and a nonsensical instruction once the frame is large enough; no
     * practical diet needs more than this in absolute terms.
     */
    maxG: 200,
    /**
     * And never more than this share of the day's calories. The rule that makes
     * "protein squeezed the carbohydrate out" impossible rather than unlikely.
     */
    maxKcalShare: 0.4,
  },
  fat: {
    /** Health floor — hormonal function. Outranks every preference below. */
    minPerKg: 0.6,
    /** Practical ceiling per kilo. */
    maxPerKg: 0.9,
    /** What fat aims at when nothing else binds: a quarter of the budget. */
    targetKcalShare: 0.25,
    /**
     * And a ceiling as a share, so a small budget does not hand fat 40-50% of
     * the day purely because the per-kilo number is large relative to it. A
     * preference, not a floor: `minPerKg` outranks it.
     */
    maxKcalShare: 0.35,
  },
  carbs: {
    /**
     * The minimum a normal plan must leave for carbohydrate. Not a nutritional
     * requirement — the body can run below it — but below this the plan stops
     * being able to fuel the training it prescribes, which is what the customer
     * is actually buying.
     */
    minG: 80,
  },
  /** Rounding slack: three macros each rounded to a whole gram. */
  driftToleranceKcal: 10,
} as const;

/**
 * The order constraints give way in, when a budget cannot hold them all.
 *
 * Read it as: fat's cosmetic ceiling goes first because it costs nothing real;
 * protein comes down off its preferred rate next, because the difference
 * between 2.0 and 1.2 g/kg is preference rather than need.
 *
 * `below_health_floors` is the last resort and the only one that breaches a
 * floor. It exists because ONE invariant outranks even the floors: the three
 * macros must always sum to the calorie target. A budget too small to hold both
 * health floors at once used to leave carbohydrate clamped at zero and the
 * three macros summing to MORE than the calories printed above them — a plan
 * that contradicts its own header, which is the one error a customer can catch
 * with a phone. So protein and fat are scaled down proportionally until they
 * fit, the sum is preserved, and `feasible: false` tells the caller this is not
 * an ordinary plan.
 */
export const RELAXATION_ORDER = [
  "fat_share_ceiling",
  "fat_toward_floor",
  "protein_toward_floor",
  "below_health_floors",
] as const;

export type Relaxation = (typeof RELAXATION_ORDER)[number];

export type AllocationInput = {
  /** From energy.ts. Never modified. */
  calories: number;
  /** Reference weight — see referenceWeightKg. Bounds are per kg of this. */
  referenceWeightKg: number;
  /** The goal's preferred protein rate, before any ceiling is applied. */
  proteinPerKgTarget: number;
};

export type Allocation = {
  proteinG: number;
  fatG: number;
  carbsG: number;
  /**
   * False when the budget could not satisfy the policy even after every
   * permitted relaxation. The numbers are still the best available split and
   * are still internally consistent — but the caller must not present them as
   * an ordinary plan.
   */
  feasible: boolean;
  /** Which constraints gave way, in the order they did. Empty is the normal case. */
  relaxations: Relaxation[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round to whole grams WITHOUT stepping outside the band that produced the
 * value.
 *
 * Plain rounding quietly breaks the policy at the last moment: 0.9 g/kg of a
 * 35 kg frame is 31.5 g, `Math.round` makes that 32, and the plan ships at
 * 0.914 g/kg — over a ceiling the solver had respected all the way through.
 * Small in grams, but it means the printed plan violates a documented bound,
 * and a bound that the output can exceed is not a bound.
 *
 * When the band is narrower than a single gram it contains no integer at all
 * (min 31.5, max 31.6). There the minimum wins, because every minimum in this
 * policy is a health floor and every maximum is a practical ceiling.
 */
function roundWithinBand(value: number, minG: number, maxG: number): number {
  const lo = Math.ceil(minG - 1e-9);
  const hi = Math.floor(maxG + 1e-9);
  if (lo > hi) return Math.max(1, lo);
  return Math.max(1, Math.min(hi, Math.max(lo, Math.round(value))));
}

/**
 * Divide a calorie budget, deterministically.
 *
 * The steps, in the order the requirements name them:
 *
 *   1. The calorie target is taken as given and never altered.
 *   2. Protein is set from the goal's rate, then capped by every ceiling —
 *      per kilo, absolute, and share of calories — then floored.
 *   3. Fat aims at its target share, clamped into its per-kilo band, then
 *      held under its share ceiling (unless that would breach the per-kilo
 *      health floor, which outranks it).
 *   4. Carbohydrate takes the remainder.
 *   5. If that remainder is under the floor, constraints give way in
 *      RELAXATION_ORDER until it is not, or the plan is declared infeasible.
 *   6. Grams are rounded last, and carbohydrate is computed FROM the rounded
 *      protein and fat so the three always re-sum to the target.
 */
export function allocateMacros(input: AllocationInput): Allocation {
  const { protein, fat, carbs } = POLICY;
  const kcal = Math.max(0, input.calories);
  const refKg = Math.max(1, input.referenceWeightKg);
  const relaxations: Relaxation[] = [];

  // ---- 2. Protein -----------------------------------------------------
  const proteinFloorG = protein.minPerKg * refKg;
  const proteinCeilingG = Math.min(
    protein.maxPerKg * refKg,
    protein.maxG,
    (kcal * protein.maxKcalShare) / KCAL_PER_G_PROTEIN,
  );
  // The ceiling can fall under the floor on a very small budget for a very
  // large frame. The floor wins; feasibility is judged at the end.
  let proteinG = clamp(input.proteinPerKgTarget * refKg, proteinFloorG, Math.max(proteinCeilingG, proteinFloorG));

  // ---- 3. Fat ---------------------------------------------------------
  const fatFloorG = fat.minPerKg * refKg;
  const fatShareCeilingG = (kcal * fat.maxKcalShare) / KCAL_PER_G_FAT;
  let fatG = clamp((kcal * fat.targetKcalShare) / KCAL_PER_G_FAT, fatFloorG, fat.maxPerKg * refKg);
  if (fatG > fatShareCeilingG) {
    // The share ceiling is a preference and the per-kilo floor is not, so this
    // can only pull fat down as far as the floor.
    const reduced = Math.max(fatShareCeilingG, fatFloorG);
    if (reduced < fatG) {
      fatG = reduced;
      relaxations.push("fat_share_ceiling");
    }
  }

  // ---- 4/5. Carbohydrate, and relaxation if it is short ----------------
  const carbFloorKcal = carbs.minG * KCAL_PER_G_CARBS;
  const remaining = () => kcal - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;

  if (remaining() < carbFloorKcal && fatG > fatFloorG) {
    const affordable = (kcal - proteinG * KCAL_PER_G_PROTEIN - carbFloorKcal) / KCAL_PER_G_FAT;
    const next = Math.max(fatFloorG, Math.min(fatG, affordable));
    if (next < fatG) {
      fatG = next;
      relaxations.push("fat_toward_floor");
    }
  }

  if (remaining() < carbFloorKcal && proteinG > proteinFloorG) {
    const affordable = (kcal - fatG * KCAL_PER_G_FAT - carbFloorKcal) / KCAL_PER_G_PROTEIN;
    const next = Math.max(proteinFloorG, Math.min(proteinG, affordable));
    if (next < proteinG) {
      proteinG = next;
      relaxations.push("protein_toward_floor");
    }
  }

  // ---- 5b. Last resort ------------------------------------------------
  // The two health floors together cost more than the entire budget. Nothing in
  // the policy can be satisfied, so the invariant that CAN be kept is kept: the
  // plan still sums to its calorie target. Proportional rather than taking it
  // all out of one macro, because at this point neither is more wrong than the
  // other.
  const floorsKcal = proteinG * KCAL_PER_G_PROTEIN + fatG * KCAL_PER_G_FAT;
  if (floorsKcal > kcal && floorsKcal > 0) {
    const scale = kcal / floorsKcal;
    proteinG *= scale;
    fatG *= scale;
    relaxations.push("below_health_floors");
  }

  // ---- 6. Round, then derive carbohydrate from the rounded values ------
  // Rounded inside the bands that produced them, so the printed plan cannot
  // violate a bound the solver honoured. Carbohydrate is computed LAST and FROM
  // the rounded protein and fat, which is what keeps the printed three summing
  // to the printed total.
  //
  // The effective ceilings are the ones actually in force after relaxation: a
  // macro that was deliberately pulled below its preferred value must not be
  // rounded back up past where the solver put it.
  const roundedProtein = roundWithinBand(
    proteinG,
    Math.min(proteinFloorG, proteinG),
    Math.min(protein.maxPerKg * refKg, protein.maxG, Math.max(proteinG, proteinFloorG)),
  );
  const roundedFat = roundWithinBand(
    fatG,
    Math.min(fatFloorG, fatG),
    Math.min(fat.maxPerKg * refKg, Math.max(fatG, fatFloorG)),
  );
  const carbsG = Math.max(
    0,
    Math.round(
      (kcal - roundedProtein * KCAL_PER_G_PROTEIN - roundedFat * KCAL_PER_G_FAT) / KCAL_PER_G_CARBS,
    ),
  );

  return {
    proteinG: roundedProtein,
    fatG: roundedFat,
    carbsG,
    feasible: carbsG >= carbs.minG,
    relaxations,
  };
}
