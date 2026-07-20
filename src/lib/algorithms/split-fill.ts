/**
 * Slot-filling workout generator — replaces the old template-copy engine
 * (`program-match.ts`, deleted in step 4).
 *
 * The old model picked a pre-built `program_templates` row and cloned its
 * concrete `template_exercises` into the user's program. This one reads the
 * abstract slot definitions migrated from splits.json —
 * `split_definitions` -> `split_days` -> `split_day_slots` — where a slot says
 * "3 chest exercises, prefer tier S then A" and the exercise is chosen at
 * generation time from whatever the user can actually and safely do.
 *
 * Every function here is pure: data in, data out, no Supabase import. The
 * server action (`app/actions/training.ts`) does the I/O and calls into this.
 */

export type Tier = "S" | "A" | "B";

export type Slot = {
  primary_muscle: string;
  exercise_slots: number;
  preferred_tiers: string[];
  order_index: number;
};

export type SplitDay = {
  day_number: number;
  day_name_en: string;
  day_name_ar: string | null;
  slots: Slot[];
};

export type Candidate = {
  id: string;
  name_en: string;
  /** NULL for cardio/stretching rows, which never fill a muscle slot. */
  primary_muscle: string | null;
  equipment: string;
  tier: Tier;
  home_friendly: boolean;
  contraindicated_for: string[] | null;
  substitution_group: string | null;
};

export type FilterOptions = {
  /** Resolved `exercises.equipment` values the user can actually reach. */
  equipment: string[];
  /** Injury labels, matched against `contraindicated_for`. */
  injuries: string[];
  /**
   * Exercise names to exclude outright. Collects every name-level rule:
   * `dislike_option_expansion`, `lift_comfort`, `age_based_exclusions` and the
   * pregnancy/postpartum lists. They all behave identically, so they share one
   * channel rather than each getting a parameter.
   */
  dislikes: string[];
  /**
   * Whole muscle groups to drop — currently only the pregnancy rule, which
   * excludes Core outright rather than naming individual exercises.
   */
  excludeMuscles?: string[];
  /**
   * Set for anyone not training in a full gym. Equipment alone is not enough:
   * Parallel Bar Dip and Hanging Leg Raise are both tagged `bodyweight` but
   * need a fixture (dip bars, pull-up bar) a home lifter may not own, so they
   * carry home_friendly = false. Without this an at-home program silently
   * includes exercises the user physically cannot perform.
   */
  requireHomeFriendly?: boolean;
};

export type Pick = {
  exerciseId: string;
  name_en: string;
  primary_muscle: string;
  order_index: number;
};

export type UnfilledSlot = {
  primary_muscle: string;
  requested: number;
  filled: number;
};

export type FilledDay = {
  day_number: number;
  day_name_en: string;
  day_name_ar: string | null;
  picks: Pick[];
  unfilled: UnfilledSlot[];
};

const TIER_RANK: Record<Tier, number> = { S: 0, A: 1, B: 2 };

/**
 * `questionnaire_rules.split_recommendation_logic` is keyed by days_per_week,
 * then narrowed by either an experience label or a goal label, with a
 * `default` fallback. Experience wins over goal: a 4-day beginner gets
 * `upper_lower_4day` even when their goal also has an entry, because the
 * beginner constraint is the stronger one.
 */
export function resolveSplitId(
  logic: Record<string, Record<string, string>>,
  profile: { daysPerWeek: number; goal: string; experience: string },
): string | null {
  const byDays = logic[String(profile.daysPerWeek)];
  if (!byDays) return null;
  return byDays[profile.experience] ?? byDays[profile.goal] ?? byDays.default ?? null;
}

/**
 * Turns the questionnaire's `location` + `equipment_gym` + `equipment_home`
 * answers into the flat `exercises.equipment` values the filter needs, using
 * `questionnaire_rules.equipment_option_map`.
 *
 * "Pull-up bar" maps to `bodyweight` because the catalog has no separate value
 * for it — see `requireHomeFriendly`, which is what actually keeps
 * fixture-dependent bodyweight work out of a home program.
 */
export function resolveEquipmentValues(
  answers: { location?: string; equipment_gym?: string[]; equipment_home?: string[] },
  optionMap: Record<string, string>,
): string[] {
  const picked: string[] = [];
  const atGym = answers.location === "Gym only" || answers.location === "Home + Gym (hybrid)";
  const atHome = answers.location === "Home only" || answers.location === "Home + Gym (hybrid)";
  if (atGym) picked.push(...(answers.equipment_gym ?? []));
  if (atHome) picked.push(...(answers.equipment_home ?? []));

  const values = picked.map((o) => optionMap[o]).filter((v): v is string => Boolean(v));
  // Bodyweight is always available regardless of what was ticked.
  if (!values.includes("bodyweight")) values.push("bodyweight");
  return [...new Set(values)];
}

/**
 * Home-only training cannot assume a dip station or pull-up bar. Hybrid users
 * have gym access, so they keep the full catalog.
 */
export function requiresHomeFriendly(location: string | undefined): boolean {
  return location === "Home only";
}

/**
 * Evaluates `questionnaire_questions.shown_if` — a map of question id to the
 * answers that reveal this question. All entries must match. An unanswered
 * dependency keeps the question hidden, so `equipment_gym` stays out of the
 * flow until `location` is actually answered.
 */
export function isQuestionVisible(
  shownIf: Record<string, string[]> | null | undefined,
  answers: Record<string, string | string[] | undefined>,
): boolean {
  if (!shownIf) return true;
  return Object.entries(shownIf).every(([dependsOn, allowed]) => {
    const given = answers[dependsOn];
    return typeof given === "string" && allowed.includes(given);
  });
}

/**
 * Dislike options are human-readable labels ("Running-based cardio"), not
 * exercise names. `dislike_option_expansion` resolves each to the exercise
 * names it actually covers.
 */
export function expandDislikes(
  selected: string[],
  expansion: Record<string, string[]>,
): string[] {
  return [...new Set(selected.flatMap((o) => expansion[o] ?? []))];
}

/** Layer 1 — hard filters. A candidate that fails any of these is never shown. */
export function filterCandidates(pool: Candidate[], opts: FilterOptions): Candidate[] {
  const dislikes = new Set(opts.dislikes);
  return pool.filter((c) => {
    // Slots are muscle-scoped, so cardio/stretching rows can never fill one.
    if (!c.primary_muscle) return false;
    if (!opts.equipment.includes(c.equipment)) return false;
    if (opts.requireHomeFriendly && !c.home_friendly) return false;
    if (dislikes.has(c.name_en)) return false;
    if (opts.excludeMuscles?.includes(c.primary_muscle)) return false;
    if (c.contraindicated_for?.length && opts.injuries.length) {
      if (c.contraindicated_for.some((i) => opts.injuries.includes(i))) return false;
    }
    return true;
  });
}

/**
 * Ranks by the slot's `preferred_tiers` first, then by absolute tier quality.
 * A tier outside `preferred_tiers` is still eligible — splits.json treats
 * tiers as a preference order, not a hard filter, so a slot never goes empty
 * just because no S/A candidate survived the injury filter.
 */
export function rankByTier(candidates: Candidate[], preferredTiers: string[]): Candidate[] {
  const preferredRank = new Map(preferredTiers.map((t, i) => [t, i]));
  return [...candidates].sort((a, b) => {
    const pa = preferredRank.get(a.tier) ?? Number.MAX_SAFE_INTEGER;
    const pb = preferredRank.get(b.tier) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return TIER_RANK[a.tier] - TIER_RANK[b.tier];
  });
}

/**
 * `slot_count_adjustment_by_duration` scales a day's TOTAL slots, not each
 * slot independently — "multiply each day's total exercise slots by this
 * factor and round to nearest whole slot before filling". Scaling per-slot
 * and rounding each one drifts badly (seven 1-slot muscles at x1.4 would
 * become seven 1s, no change at all), so this hits the rounded total exactly
 * using largest-remainder apportionment. Every slot keeps at least 1.
 */
export function scaleSlotsForDuration(slots: Slot[], factor: number): Slot[] {
  if (factor === 1 || slots.length === 0) return slots;

  const total = slots.reduce((n, s) => n + s.exercise_slots, 0);
  const target = Math.max(slots.length, Math.round(total * factor));

  const raw = slots.map((s) => s.exercise_slots * factor);
  const floored = raw.map((r) => Math.max(1, Math.floor(r)));
  let used = floored.reduce((n, v) => n + v, 0);

  const order = raw
    .map((r, i) => ({ i, remainder: r - Math.floor(r) }))
    .sort((a, b) => b.remainder - a.remainder);

  const result = [...floored];
  let cursor = 0;
  while (used < target && order.length > 0) {
    result[order[cursor % order.length].i] += 1;
    used += 1;
    cursor += 1;
  }
  // Overshoot can only come from the min-1 clamp; trim the largest slots.
  while (used > target) {
    const biggest = result.reduce((best, v, i) => (v > result[best] ? i : best), 0);
    if (result[biggest] <= 1) break;
    result[biggest] -= 1;
    used -= 1;
  }

  return slots.map((s, i) => ({ ...s, exercise_slots: result[i] }));
}

/**
 * `body_focus_boost` adds +1 slot to a chosen muscle on the days it already
 * appears — it never introduces a muscle to a day that doesn't train it.
 * `Arms` maps to two muscles (biceps + triceps); both get the boost.
 */
export function applyBodyFocusBoost(
  slots: Slot[],
  focuses: string[],
  boostRules: Record<string, { muscle_group: string | string[]; add_slots: number }>,
): Slot[] {
  if (focuses.length === 0) return slots;

  const boostByMuscle = new Map<string, number>();
  for (const focus of focuses) {
    const rule = boostRules[focus];
    if (!rule) continue;
    const muscles = Array.isArray(rule.muscle_group) ? rule.muscle_group : [rule.muscle_group];
    for (const m of muscles) {
      const key = m.toLowerCase();
      boostByMuscle.set(key, (boostByMuscle.get(key) ?? 0) + rule.add_slots);
    }
  }

  return slots.map((s) => {
    const boost = boostByMuscle.get(s.primary_muscle);
    return boost ? { ...s, exercise_slots: s.exercise_slots + boost } : s;
  });
}

/**
 * Fills one day. Picks are unique within the day — the same exercise is never
 * assigned twice even when a muscle has several slots. A slot that runs out of
 * candidates is reported in `unfilled` rather than silently shrinking, so the
 * caller can surface a real gap instead of quietly handing over a short day.
 */
export function fillDay(day: SplitDay, pool: Candidate[], opts: FilterOptions): FilledDay {
  const safe = filterCandidates(pool, opts);
  const used = new Set<string>();
  const picks: Pick[] = [];
  const unfilled: UnfilledSlot[] = [];
  let order = 0;

  for (const slot of [...day.slots].sort((a, b) => a.order_index - b.order_index)) {
    const ranked = rankByTier(
      safe.filter((c) => c.primary_muscle === slot.primary_muscle && !used.has(c.id)),
      slot.preferred_tiers,
    );
    const take = ranked.slice(0, slot.exercise_slots);
    for (const c of take) {
      used.add(c.id);
      picks.push({
        exerciseId: c.id,
        name_en: c.name_en,
        primary_muscle: slot.primary_muscle,
        order_index: order++,
      });
    }
    if (take.length < slot.exercise_slots) {
      unfilled.push({
        primary_muscle: slot.primary_muscle,
        requested: slot.exercise_slots,
        filled: take.length,
      });
    }
  }

  return {
    day_number: day.day_number,
    day_name_en: day.day_name_en,
    day_name_ar: day.day_name_ar,
    picks,
    unfilled,
  };
}

/**
 * Full generation for one split: applies the duration multiplier and body-focus
 * boost to every day, then fills each. Boost is applied before the duration
 * scale so an explicit focus survives a short-session downscale.
 */
export function generateProgram(
  days: SplitDay[],
  pool: Candidate[],
  opts: FilterOptions & {
    durationFactor: number;
    bodyFocus: string[];
    bodyFocusRules: Record<string, { muscle_group: string | string[]; add_slots: number }>;
  },
): FilledDay[] {
  return days.map((day) => {
    const boosted = applyBodyFocusBoost(day.slots, opts.bodyFocus, opts.bodyFocusRules);
    const scaled = scaleSlotsForDuration(boosted, opts.durationFactor);
    return fillDay({ ...day, slots: scaled }, pool, opts);
  });
}

/**
 * Sets/reps/rest for a generated pick. `training_style_rep_ranges` overrides
 * the goal default whenever the user gave an explicit style; "Not sure" falls
 * through to the goal-derived default.
 */
export function repSchemeFor(opts: { goal: string; trainingStyle?: string }): {
  sets: number;
  repRange: string;
  restSeconds: number;
} {
  const style = opts.trainingStyle ?? "";
  if (style.startsWith("Heavy weight")) return { sets: 4, repRange: "4-6", restSeconds: 150 };
  if (style.startsWith("Moderate weight")) return { sets: 3, repRange: "8-12", restSeconds: 75 };
  if (style.startsWith("Lighter weight")) return { sets: 3, repRange: "12-20", restSeconds: 45 };

  // "Not sure — let my goal decide", or no style answered yet.
  if (opts.goal === "Strength") return { sets: 4, repRange: "4-6", restSeconds: 150 };
  if (opts.goal === "Fat loss") return { sets: 3, repRange: "10-15", restSeconds: 60 };
  return { sets: 3, repRange: "8-12", restSeconds: 90 };
}
