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

export type Role =
  | "opener_heavy"
  | "opener_compound"
  | "opener_isolation"
  | "mid_compound"
  | "mid_compound_machine"
  | "mid_isolation"
  | "finisher_compound"
  | "finisher_isolation";

/** Sequence position within a muscle block: openers first, finishers last. */
const ROLE_RANK: Record<Role, number> = {
  opener_heavy: 0,
  opener_compound: 1,
  opener_isolation: 2,
  mid_compound: 3,
  mid_compound_machine: 4,
  mid_isolation: 5,
  finisher_compound: 6,
  finisher_isolation: 7,
};

/** Drives the compound/isolation split in `sets_reps_by_style`. */
export function isCompoundRole(role: Role): boolean {
  return role === "opener_heavy" || role === "opener_compound"
    || role === "mid_compound" || role === "mid_compound_machine"
    || role === "finisher_compound";
}

/**
 * Order muscles are trained within a day: large before small, calves then core
 * last. One list reproduces every `day_template` sequence in the spec — Push
 * (chest→shoulders→triceps), Pull (back→biceps→forearms), Legs
 * (quads→hamstrings→glutes→calves→core), Upper, Lower, Chest & Back,
 * Shoulders & Arms — so day names are never hardcoded and a new split works
 * automatically.
 *
 * Core is last by design: never pre-fatigue the trunk before heavy lower-body
 * work.
 */
const MUSCLE_ORDER: Record<string, number> = {
  chest: 0, back: 1, shoulders: 2,
  quads: 3, hamstrings: 4, glutes: 5,
  biceps: 6, triceps: 7, forearms: 8,
  calves: 9, core: 10,
};

/** Shoulder blocks run rear → side → front → press (pre-exhaustion order). */
const SHOULDER_REGION_ORDER: Record<string, number> = {
  rear_delt_region: 0,
  rotator_cuff_region: 1,
  side_delt_region: 2,
  front_delt_region: 3,
  press_region: 4,
};

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
  /** NULL only for cardio/stretching rows (migration 024). */
  role: Role | null;
  sub_target: string | null;
  true_max_effort: boolean;
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
  role: Role;
  sub_target: string | null;
  true_max_effort: boolean;
  sets: number;
  repRange: string;
  restSeconds: number;
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
 *
 * When two candidates tie on tier, role rank decides — an `opener_heavy`
 * outranks an `opener_compound` within the same tier bucket. Without this,
 * Back Squat (opener_heavy, S) tied with Pistol Squat (opener_compound, S)
 * and the ranker broke the tie alphabetically, filling a leg opener with a
 * bodyweight single-leg squat instead of a barbell squat.
 */
export function rankByTier(candidates: Candidate[], preferredTiers: string[]): Candidate[] {
  const preferredRank = new Map(preferredTiers.map((t, i) => [t, i]));
  return [...candidates].sort((a, b) => {
    const pa = preferredRank.get(a.tier) ?? Number.MAX_SAFE_INTEGER;
    const pb = preferredRank.get(b.tier) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    if (a.tier !== b.tier) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
    const ra = a.role ? ROLE_RANK[a.role] : 99;
    const rb = b.role ? ROLE_RANK[b.role] : 99;
    return ra - rb;
  });
}

/**
 * Picks `count` exercises for one muscle block, prioritising tier and using
 * `substitution_group` for variety.
 *
 * The spec's own model: `substitution_group` marks exercises that are
 * "interchangeable" — so two picks from the same group are redundant, and
 * variety across groups naturally produces the role mix ordering wants
 * (opener_heavy, mid_compound, finisher_isolation live in different groups).
 *
 * Rule: walk the tier-ranked list, skip any candidate whose group is already
 * taken, and only allow duplicates if the pool would otherwise underfill.
 * A candidate with NO group (only reachable if selection widens to
 * cardio/stretching rows, which it doesn't today) is always allowed.
 *
 * An earlier attempt reserved a "finisher slot" regardless of tier. On a
 * 2-slot Upper chest block that pulled Band Chest Press (B, finisher_compound)
 * over Incline Barbell Press (S, opener_heavy) because the reservation beat
 * quality. This variant produces Bench + Incline instead — both compounds,
 * both S, different groups, honest.
 */
const isBarbellCompound = (c: Candidate): boolean =>
  c.equipment === "barbell" && !!c.role && isCompoundRole(c.role);

export function selectForBlock(
  candidates: Candidate[],
  count: number,
  preferredTiers: string[],
): Candidate[] {
  if (count <= 0) return [];
  const ranked = rankByTier(candidates, preferredTiers);

  const chosen: Candidate[] = [];
  const groupsUsed = new Set<string>();
  let barbellCompoundPicked = false;

  // First pass: enforce group variety + cap barbell compounds at 1 per block.
  // The cap stops Bench + Incline Barbell (or Deadlift + Bent-Over Row) from
  // both landing in the same muscle block — two heavy barbell lifts on the
  // same muscle is redundant and cooks the block.
  for (const c of ranked) {
    if (chosen.length >= count) break;
    if (c.substitution_group && groupsUsed.has(c.substitution_group)) continue;
    if (barbellCompoundPicked && isBarbellCompound(c)) continue;
    chosen.push(c);
    if (c.substitution_group) groupsUsed.add(c.substitution_group);
    if (isBarbellCompound(c)) barbellCompoundPicked = true;
  }

  // Second pass: if the constraints left us short (small home pools, or a
  // muscle whose only good options are all barbell compounds), allow both
  // duplicates. The block must still fill.
  if (chosen.length < count) {
    for (const c of ranked) {
      if (chosen.length >= count) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }

  return chosen.slice(0, count);
}

/**
 * Orders one muscle's picks. Roles run opener -> mid -> finisher, except
 * shoulders, which run by region (rear -> cuff -> side -> front -> press) as a
 * deliberate pre-exhaustion sequence.
 *
 * The exception the spec calls out: if the selected press is `true_max_effort`
 * (a heavy barbell overhead press) it leads the block instead of ending it —
 * pre-exhausting before a max-effort lift costs more load than the activation
 * is worth.
 */
export function orderBlock(picks: Candidate[]): Candidate[] {
  const isShoulders = picks.length > 0 && picks[0].primary_muscle === "shoulders";

  if (isShoulders && !picks.some((p) => p.true_max_effort && p.sub_target === "press_region")) {
    return [...picks].sort((a, b) => {
      const ra = SHOULDER_REGION_ORDER[a.sub_target ?? ""] ?? 99;
      const rb = SHOULDER_REGION_ORDER[b.sub_target ?? ""] ?? 99;
      if (ra !== rb) return ra - rb;
      return ROLE_RANK[a.role!] - ROLE_RANK[b.role!];
    });
  }

  return [...picks].sort((a, b) => {
    if (a.true_max_effort !== b.true_max_effort) return a.true_max_effort ? -1 : 1;
    return ROLE_RANK[a.role!] - ROLE_RANK[b.role!];
  });
}

/**
 * Sequences a whole day: muscle blocks in `MUSCLE_ORDER` (large to small,
 * calves then core last), each block internally ordered by `orderBlock`.
 *
 * A `true_max_effort` lift leads its own block (handled in `orderBlock`) and
 * is guaranteed not to be the last exercise of the day. It does NOT jump
 * across muscle blocks: on a Legs day, Hip Thrust (a glute max-effort) must
 * not shove Back Squat out of position 1 — the large-muscle-first sequence
 * is stronger than the promotion. If the day happens to end on a max-effort
 * lift because its muscle sits last (e.g. an isolated glute finisher), the
 * lift is swapped one step earlier so it isn't the closer.
 */
export function orderDay(picks: Candidate[]): Candidate[] {
  const byMuscle = new Map<string, Candidate[]>();
  for (const p of picks) {
    const m = p.primary_muscle ?? "";
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m)!.push(p);
  }

  const ordered = [...byMuscle.entries()]
    .sort((a, b) => (MUSCLE_ORDER[a[0]] ?? 99) - (MUSCLE_ORDER[b[0]] ?? 99))
    .flatMap(([, block]) => orderBlock(block));

  // "Never last": if the day ends on a max-effort lift, find the nearest
  // non-max-effort exercise earlier in the day and swap them. Skipping other
  // max-effort lifts matters — swapping Hip Thrust with Back Squat still
  // leaves a max-effort lift closing the day.
  const n = ordered.length;
  if (n >= 2 && ordered[n - 1].true_max_effort) {
    for (let i = n - 2; i >= 0; i--) {
      if (!ordered[i].true_max_effort) {
        [ordered[i], ordered[n - 1]] = [ordered[n - 1], ordered[i]];
        break;
      }
    }
  }
  return ordered;
}

/**
 * Fills one day. Picks are unique within the day — the same exercise is never
 * assigned twice even when a muscle has several slots. A slot that runs out of
 * candidates is reported in `unfilled` rather than silently shrinking, so the
 * caller can surface a real gap instead of quietly handing over a short day.
 */
export function fillDay(
  day: SplitDay,
  pool: Candidate[],
  opts: FilterOptions & { goal: string; trainingStyle?: string },
): FilledDay {
  const safe = filterCandidates(pool, opts);
  const used = new Set<string>();
  const selected: Candidate[] = [];
  const unfilled: UnfilledSlot[] = [];

  for (const slot of [...day.slots].sort((a, b) => a.order_index - b.order_index)) {
    const available = safe.filter((c) => c.primary_muscle === slot.primary_muscle && !used.has(c.id));
    const take = selectForBlock(available, slot.exercise_slots, slot.preferred_tiers);
    for (const c of take) used.add(c.id);
    selected.push(...take);

    if (take.length < slot.exercise_slots) {
      unfilled.push({
        primary_muscle: slot.primary_muscle,
        requested: slot.exercise_slots,
        filled: take.length,
      });
    }
  }

  const picks = orderDay(selected).map((c, i) => {
    const scheme = setsRepsFor(c.role!, opts);
    return {
      exerciseId: c.id,
      name_en: c.name_en,
      primary_muscle: c.primary_muscle!,
      order_index: i,
      role: c.role!,
      sub_target: c.sub_target,
      true_max_effort: c.true_max_effort,
      ...scheme,
    };
  });

  return {
    day_number: day.day_number,
    day_name_en: day.day_name_en,
    day_name_ar: day.day_name_ar,
    picks,
    unfilled,
  };
}

/**
 * Full generation for one split: fills each day straight from its
 * `split_day_slots` definitions. A day's exercise count is fixed by the day
 * type alone — the old session-duration multiplier and body-focus boost are
 * gone (migration 026), so no user input can change how many exercises a
 * day holds.
 */
export function generateProgram(
  days: SplitDay[],
  pool: Candidate[],
  opts: FilterOptions & { goal: string; trainingStyle?: string },
): FilledDay[] {
  return days.map((day) => fillDay(day, pool, opts));
}

export type SetScheme = { sets: number; repRange: string; restSeconds: number };

/**
 * `sets_reps_by_style` — compounds and isolations get different prescriptions
 * rather than one number for the whole day. A heavy press and a lateral raise
 * are not the same stimulus and should not share 4x4-6 with 150s rest.
 *
 * An explicit `training_style` wins; "Not sure" falls through to the goal.
 */
const SCHEMES: Record<string, { compound: SetScheme; isolation: SetScheme }> = {
  heavy: {
    compound: { sets: 4, repRange: "6-8", restSeconds: 150 },
    isolation: { sets: 3, repRange: "8-12", restSeconds: 90 },
  },
  moderate: {
    compound: { sets: 3, repRange: "8-12", restSeconds: 90 },
    isolation: { sets: 3, repRange: "12-15", restSeconds: 60 },
  },
  lighter: {
    compound: { sets: 3, repRange: "12-15", restSeconds: 60 },
    isolation: { sets: 2, repRange: "15-20", restSeconds: 45 },
  },
  strength: {
    compound: { sets: 4, repRange: "6-8", restSeconds: 150 },
    isolation: { sets: 3, repRange: "8-12", restSeconds: 90 },
  },
  fatloss: {
    compound: { sets: 3, repRange: "10-15", restSeconds: 60 },
    isolation: { sets: 2, repRange: "15-20", restSeconds: 45 },
  },
  default: {
    compound: { sets: 3, repRange: "8-12", restSeconds: 90 },
    isolation: { sets: 3, repRange: "12-15", restSeconds: 60 },
  },
};

function schemeKeyFor(opts: { goal: string; trainingStyle?: string }): string {
  const style = opts.trainingStyle ?? "";
  if (style.startsWith("Heavy weight")) return "heavy";
  if (style.startsWith("Moderate weight")) return "moderate";
  if (style.startsWith("Lighter weight")) return "lighter";
  if (opts.goal === "Strength") return "strength";
  if (opts.goal === "Fat loss") return "fatloss";
  return "default";
}

/**
 * Floors from the spec: sets >= 2 and reps >= 6, enforced everywhere so no
 * combination of style and role can produce a single-set or sub-6-rep
 * prescription.
 */
function applyFloors(s: SetScheme): SetScheme {
  const [lo, hi] = s.repRange.split("-").map(Number);
  const floorLo = Math.max(6, lo);
  const floorHi = Math.max(floorLo, hi);
  return {
    sets: Math.max(2, s.sets),
    repRange: `${floorLo}-${floorHi}`,
    restSeconds: s.restSeconds,
  };
}

export function setsRepsFor(role: Role, opts: { goal: string; trainingStyle?: string }): SetScheme {
  const table = SCHEMES[schemeKeyFor(opts)];
  return applyFloors(isCompoundRole(role) ? table.compound : table.isolation);
}
