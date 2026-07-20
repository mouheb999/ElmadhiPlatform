import { describe, it, expect } from "vitest";
import {
  resolveSplitId,
  resolveEquipmentValues,
  isQuestionVisible,
  requiresHomeFriendly,
  expandDislikes,
  filterCandidates,
  rankByTier,
  fillDay,
  generateProgram,
  setsRepsFor,
  isCompoundRole,
  selectForBlock,
  orderBlock,
  orderDay,
  type Candidate,
  type Slot,
  type SplitDay,
} from "./split-fill";

const ex = (over: Partial<Candidate> & { id: string }): Candidate => ({
  name_en: over.id,
  primary_muscle: "chest",
  equipment: "bodyweight",
  tier: "B",
  home_friendly: true,
  contraindicated_for: null,
  substitution_group: null,
  role: "mid_isolation",
  sub_target: null,
  true_max_effort: false,
  ...over,
});

const SCHEME_OPTS = { goal: "Muscle growth (hypertrophy)" };

const slot = (over: Partial<Slot> & { primary_muscle: string }): Slot => ({
  exercise_slots: 1,
  preferred_tiers: ["S", "A"],
  order_index: 0,
  ...over,
});

const ALL_EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "band", "plate"];
const NO_LIMITS = { equipment: ALL_EQUIPMENT, injuries: [] as string[], dislikes: [] as string[] };
const FILL = { ...NO_LIMITS, ...SCHEME_OPTS };

describe("resolveSplitId", () => {
  const logic = {
    "4": {
      "Beginner (0-6 months)": "upper_lower_4day",
      "Muscle growth (hypertrophy)": "arnold_ul_4day",
      default: "ppl_ul_4day",
    },
    "5": { default: "arnold_ppl_5day" },
  };

  it("prefers experience over goal when both match", () => {
    expect(
      resolveSplitId(logic, {
        daysPerWeek: 4,
        goal: "Muscle growth (hypertrophy)",
        experience: "Beginner (0-6 months)",
      }),
    ).toBe("upper_lower_4day");
  });

  it("falls back to goal when experience has no entry", () => {
    expect(
      resolveSplitId(logic, {
        daysPerWeek: 4,
        goal: "Muscle growth (hypertrophy)",
        experience: "Advanced (2+ yrs)",
      }),
    ).toBe("arnold_ul_4day");
  });

  it("falls back to default when neither matches", () => {
    expect(
      resolveSplitId(logic, { daysPerWeek: 4, goal: "Fat loss", experience: "Advanced (2+ yrs)" }),
    ).toBe("ppl_ul_4day");
  });

  it("returns null for a day count with no split", () => {
    expect(resolveSplitId(logic, { daysPerWeek: 3, goal: "Strength", experience: "Beginner (0-6 months)" })).toBeNull();
  });
});

describe("isQuestionVisible", () => {
  it("shows a question with no shown_if", () => {
    expect(isQuestionVisible(null, {})).toBe(true);
  });

  it("hides equipment_gym for a home-only user", () => {
    const shownIf = { location: ["Gym only", "Home + Gym (hybrid)"] };
    expect(isQuestionVisible(shownIf, { location: "Home only" })).toBe(false);
    expect(isQuestionVisible(shownIf, { location: "Gym only" })).toBe(true);
    expect(isQuestionVisible(shownIf, { location: "Home + Gym (hybrid)" })).toBe(true);
  });

  it("shows both equipment questions for a hybrid user", () => {
    const gym = { location: ["Gym only", "Home + Gym (hybrid)"] };
    const home = { location: ["Home only", "Home + Gym (hybrid)"] };
    const answers = { location: "Home + Gym (hybrid)" };
    expect(isQuestionVisible(gym, answers)).toBe(true);
    expect(isQuestionVisible(home, answers)).toBe(true);
  });

  it("gates pregnancy_status behind gender", () => {
    const shownIf = { gender: ["Female"] };
    expect(isQuestionVisible(shownIf, { gender: "Male" })).toBe(false);
    expect(isQuestionVisible(shownIf, { gender: "Prefer not to say" })).toBe(false);
    expect(isQuestionVisible(shownIf, { gender: "Female" })).toBe(true);
  });

  it("stays hidden while the dependency is unanswered", () => {
    expect(isQuestionVisible({ location: ["Gym only"] }, {})).toBe(false);
  });

  it("ignores an array answer for a single-select dependency", () => {
    expect(isQuestionVisible({ location: ["Gym only"] }, { location: ["Gym only"] })).toBe(false);
  });
});

describe("resolveEquipmentValues", () => {
  const map = {
    Barbell: "barbell",
    Dumbbells: "dumbbell",
    "Cable machines": "cable",
    "Selectorized machines": "machine",
    Kettlebell: "kettlebell",
    "Resistance bands": "band",
    "Pull-up bar": "bodyweight",
    "Bodyweight only": "bodyweight",
  };

  it("uses only the gym answers for a gym-only user", () => {
    const out = resolveEquipmentValues(
      { location: "Gym only", equipment_gym: ["Barbell", "Cable machines"], equipment_home: ["Resistance bands"] },
      map,
    );
    expect(out.sort()).toEqual(["barbell", "bodyweight", "cable"]);
  });

  it("uses only the home answers for a home-only user", () => {
    const out = resolveEquipmentValues(
      { location: "Home only", equipment_gym: ["Barbell"], equipment_home: ["Dumbbells"] },
      map,
    );
    expect(out.sort()).toEqual(["bodyweight", "dumbbell"]);
  });

  it("unions both for a hybrid user", () => {
    const out = resolveEquipmentValues(
      { location: "Home + Gym (hybrid)", equipment_gym: ["Barbell"], equipment_home: ["Dumbbells"] },
      map,
    );
    expect(out.sort()).toEqual(["barbell", "bodyweight", "dumbbell"]);
  });

  it("always includes bodyweight even when nothing is ticked", () => {
    expect(resolveEquipmentValues({ location: "Home only", equipment_home: [] }, map)).toEqual(["bodyweight"]);
  });

  it("maps Pull-up bar onto bodyweight without duplicating it", () => {
    const out = resolveEquipmentValues(
      { location: "Home only", equipment_home: ["Pull-up bar", "Bodyweight only"] },
      map,
    );
    expect(out).toEqual(["bodyweight"]);
  });
});

describe("requiresHomeFriendly", () => {
  it("is true only for home-only training", () => {
    expect(requiresHomeFriendly("Home only")).toBe(true);
    expect(requiresHomeFriendly("Home + Gym (hybrid)")).toBe(false);
    expect(requiresHomeFriendly("Gym only")).toBe(false);
    expect(requiresHomeFriendly(undefined)).toBe(false);
  });
});

describe("expandDislikes", () => {
  const expansion = {
    Burpees: ["Burpee"],
    "Running-based cardio": ["Treadmill Run", "Sprint Intervals", "High Knees"],
    Deadlift: ["Deadlift"],
  };

  it("expands a category label into every exercise it covers", () => {
    expect(expandDislikes(["Running-based cardio"], expansion)).toEqual([
      "Treadmill Run",
      "Sprint Intervals",
      "High Knees",
    ]);
  });

  it("resolves a plural label to the singular exercise name", () => {
    expect(expandDislikes(["Burpees"], expansion)).toEqual(["Burpee"]);
  });

  it("ignores options with no expansion entry, such as 'None'", () => {
    expect(expandDislikes(["None — open to anything"], expansion)).toEqual([]);
  });

  it("de-duplicates across overlapping selections", () => {
    expect(expandDislikes(["Deadlift", "Deadlift"], expansion)).toEqual(["Deadlift"]);
  });
});

describe("filterCandidates", () => {
  it("drops exercises whose equipment the user cannot reach", () => {
    const pool = [ex({ id: "push-up", equipment: "bodyweight" }), ex({ id: "bench", equipment: "barbell" })];
    const out = filterCandidates(pool, { equipment: ["bodyweight"], injuries: [], dislikes: [] });
    expect(out.map((c) => c.id)).toEqual(["push-up"]);
  });

  it("drops exercises contraindicated for a declared injury", () => {
    const pool = [
      ex({ id: "bench", contraindicated_for: ["Shoulder"] }),
      ex({ id: "fly", contraindicated_for: ["Lower back"] }),
    ];
    const out = filterCandidates(pool, { ...NO_LIMITS, injuries: ["Shoulder"] });
    expect(out.map((c) => c.id)).toEqual(["fly"]);
  });

  it("keeps contraindicated exercises when the user declared no injury", () => {
    const pool = [ex({ id: "bench", contraindicated_for: ["Shoulder"] })];
    expect(filterCandidates(pool, NO_LIMITS)).toHaveLength(1);
  });

  it("drops disliked exercises by name", () => {
    const pool = [ex({ id: "a", name_en: "Burpee" }), ex({ id: "b", name_en: "Push-Up" })];
    const out = filterCandidates(pool, { ...NO_LIMITS, dislikes: ["Burpee"] });
    expect(out.map((c) => c.name_en)).toEqual(["Push-Up"]);
  });

  it("never returns cardio/stretching rows, which have no muscle to slot into", () => {
    const pool = [ex({ id: "run", primary_muscle: null }), ex({ id: "push-up" })];
    expect(filterCandidates(pool, NO_LIMITS).map((c) => c.id)).toEqual(["push-up"]);
  });

  it("drops fixture-dependent bodyweight exercises for a home user", () => {
    // Both are equipment 'bodyweight', so an equipment-only filter would keep
    // them — but a dip station / pull-up bar is not a given at home.
    const pool = [
      ex({ id: "dip", name_en: "Parallel Bar Dip", equipment: "bodyweight", home_friendly: false }),
      ex({ id: "hlr", name_en: "Hanging Leg Raise", equipment: "bodyweight", home_friendly: false }),
      ex({ id: "pu", name_en: "Push-Up", equipment: "bodyweight", home_friendly: true }),
    ];
    const out = filterCandidates(pool, { ...NO_LIMITS, equipment: ["bodyweight"], requireHomeFriendly: true });
    expect(out.map((c) => c.name_en)).toEqual(["Push-Up"]);
  });

  it("keeps those same exercises for a full-gym user", () => {
    const pool = [ex({ id: "dip", equipment: "bodyweight", home_friendly: false })];
    expect(filterCandidates(pool, { ...NO_LIMITS, equipment: ["bodyweight"] })).toHaveLength(1);
  });
});

describe("rankByTier", () => {
  it("orders by the slot's preferred tiers first", () => {
    const pool = [ex({ id: "b", tier: "B" }), ex({ id: "s", tier: "S" }), ex({ id: "a", tier: "A" })];
    expect(rankByTier(pool, ["S", "A"]).map((c) => c.id)).toEqual(["s", "a", "b"]);
  });

  it("honours an unusual preference order like the Forearms [A,B] slot", () => {
    const pool = [ex({ id: "s", tier: "S" }), ex({ id: "b", tier: "B" }), ex({ id: "a", tier: "A" })];
    expect(rankByTier(pool, ["A", "B"]).map((c) => c.id)).toEqual(["a", "b", "s"]);
  });

  it("still ranks tiers outside preferred_tiers rather than dropping them", () => {
    const pool = [ex({ id: "b", tier: "B" })];
    expect(rankByTier(pool, ["S", "A"]).map((c) => c.id)).toEqual(["b"]);
  });

  it("does not mutate the input array", () => {
    const pool = [ex({ id: "b", tier: "B" }), ex({ id: "s", tier: "S" })];
    rankByTier(pool, ["S"]);
    expect(pool.map((c) => c.id)).toEqual(["b", "s"]);
  });

  it("breaks tier ties by role rank, not alphabetically", () => {
    // Back Squat (opener_heavy) vs Pistol Squat (opener_compound) — both S.
    const pool = [
      ex({ id: "pistol", tier: "S", role: "opener_compound" }),
      ex({ id: "back-squat", tier: "S", role: "opener_heavy", true_max_effort: true }),
    ];
    expect(rankByTier(pool, ["S", "A"])[0].id).toBe("back-squat");
  });
});

describe("fillDay", () => {
  const day: SplitDay = {
    day_number: 1,
    day_name_en: "Push",
    day_name_ar: "دفع",
    slots: [
      slot({ primary_muscle: "chest", exercise_slots: 2, order_index: 0 }),
      slot({ primary_muscle: "triceps", exercise_slots: 1, order_index: 1 }),
    ],
  };

  const pool = [
    ex({ id: "c1", primary_muscle: "chest", tier: "S" }),
    ex({ id: "c2", primary_muscle: "chest", tier: "A" }),
    ex({ id: "c3", primary_muscle: "chest", tier: "B" }),
    ex({ id: "t1", primary_muscle: "triceps", tier: "S" }),
  ];

  it("fills each slot with the best available tiers", () => {
    const out = fillDay(day, pool, FILL);
    expect(out.picks.map((p) => p.exerciseId)).toEqual(["c1", "c2", "t1"]);
    expect(out.unfilled).toEqual([]);
  });

  it("never picks the same exercise twice in a day", () => {
    const out = fillDay(day, pool, FILL);
    expect(new Set(out.picks.map((p) => p.exerciseId)).size).toBe(out.picks.length);
  });

  it("assigns a contiguous order_index across slots", () => {
    const out = fillDay(day, pool, FILL);
    expect(out.picks.map((p) => p.order_index)).toEqual([0, 1, 2]);
  });

  it("reports a short slot instead of silently shrinking the day", () => {
    const thin = [ex({ id: "c1", primary_muscle: "chest", tier: "S" })];
    const out = fillDay(day, thin, FILL);
    expect(out.picks).toHaveLength(1);
    expect(out.unfilled).toEqual([
      { primary_muscle: "chest", requested: 2, filled: 1 },
      { primary_muscle: "triceps", requested: 1, filled: 0 },
    ]);
  });

  it("reports every slot unfilled when injuries eliminate the pool", () => {
    const out = fillDay(day, pool, { ...FILL, injuries: ["Shoulder"] });
    expect(out.picks).toHaveLength(3); // nothing in this pool is contraindicated
    const injured = fillDay(
      day,
      pool.map((c) => ({ ...c, contraindicated_for: ["Shoulder"] })),
      { ...FILL, injuries: ["Shoulder"] },
    );
    expect(injured.picks).toHaveLength(0);
    expect(injured.unfilled).toHaveLength(2);
  });
});

describe("generateProgram", () => {
  const days: SplitDay[] = [
    {
      day_number: 1,
      day_name_en: "Push",
      day_name_ar: null,
      slots: [slot({ primary_muscle: "chest", exercise_slots: 2, order_index: 0 })],
    },
    {
      day_number: 2,
      day_name_en: "Pull",
      day_name_ar: null,
      slots: [slot({ primary_muscle: "back", exercise_slots: 2, order_index: 0 })],
    },
  ];

  const pool = [
    ...["c1", "c2", "c3"].map((id) => ex({ id, primary_muscle: "chest", tier: "S" })),
    ...["b1", "b2", "b3"].map((id) => ex({ id, primary_muscle: "back", tier: "S" })),
  ];

  const base = { ...NO_LIMITS, ...SCHEME_OPTS };

  it("fills every day of the split", () => {
    const out = generateProgram(days, pool, base);
    expect(out).toHaveLength(2);
    expect(out.flatMap((d) => d.picks)).toHaveLength(4);
  });

  it("gives each day exactly its slot-defined exercise count", () => {
    // Exercise count is fixed per day type by split_day_slots — there is no
    // duration multiplier or body-focus boost anymore (migration 026).
    const out = generateProgram(days, pool, base);
    for (const day of out) {
      const defined = days.find((d) => d.day_number === day.day_number)!;
      const slotTotal = defined.slots.reduce((n, s) => n + s.exercise_slots, 0);
      expect(day.picks).toHaveLength(slotTotal);
    }
  });

  it("keeps the exercise count identical across every user profile", () => {
    // Goal and training style change sets/reps, never how many exercises a
    // day holds — the inputs that used to change the count no longer exist.
    const profiles = [
      base,
      { ...base, goal: "Strength" },
      { ...base, goal: "Fat loss", trainingStyle: "Lighter weight, high reps (pump / endurance feel)" },
      { ...base, goal: "Muscle growth (hypertrophy)", trainingStyle: "Heavy weight, low reps (strength feel)" },
    ];
    const counts = profiles.map((p) => generateProgram(days, pool, p).map((d) => d.picks.length));
    for (const c of counts) expect(c).toEqual(counts[0]);
  });

  it("allows the same exercise on different days", () => {
    const twoPushDays = [days[0], { ...days[0], day_number: 2 }];
    const out = generateProgram(twoPushDays, pool, base);
    expect(out[0].picks[0].exerciseId).toBe(out[1].picks[0].exerciseId);
  });
});

describe("isCompoundRole", () => {
  it("classifies every role on the compound side", () => {
    for (const r of ["opener_heavy", "opener_compound", "mid_compound", "mid_compound_machine", "finisher_compound"] as const)
      expect(isCompoundRole(r)).toBe(true);
  });
  it("classifies every role on the isolation side", () => {
    for (const r of ["opener_isolation", "mid_isolation", "finisher_isolation"] as const)
      expect(isCompoundRole(r)).toBe(false);
  });
});

describe("setsRepsFor", () => {
  it("gives compounds and isolations different prescriptions on the same day", () => {
    const opts = { goal: "Muscle growth (hypertrophy)", trainingStyle: "Heavy weight, low reps (strength feel)" };
    expect(setsRepsFor("opener_heavy", opts)).toEqual({ sets: 4, repRange: "6-8", restSeconds: 150 });
    expect(setsRepsFor("finisher_isolation", opts)).toEqual({ sets: 3, repRange: "8-12", restSeconds: 90 });
  });

  it("lets an explicit training style override the goal", () => {
    const out = setsRepsFor("opener_heavy", { goal: "Fat loss", trainingStyle: "Heavy weight, low reps (strength feel)" });
    expect(out.repRange).toBe("6-8");
  });

  it("falls back to the goal when the user is not sure", () => {
    const out = setsRepsFor("opener_heavy", { goal: "Strength", trainingStyle: "Not sure — let my goal decide" });
    expect(out.repRange).toBe("6-8");
  });

  it("uses higher reps and shorter rest for fat loss isolation work", () => {
    expect(setsRepsFor("mid_isolation", { goal: "Fat loss" })).toEqual({ sets: 2, repRange: "15-20", restSeconds: 45 });
  });

  it("never drops below the 2-set / 6-rep floor", () => {
    for (const goal of ["Strength", "Fat loss", "Muscle growth (hypertrophy)"]) {
      for (const style of ["Heavy weight, low reps", "Moderate weight", "Lighter weight, high reps", undefined]) {
        for (const role of ["opener_heavy", "mid_isolation", "finisher_isolation"] as const) {
          const s = setsRepsFor(role, { goal, trainingStyle: style });
          expect(s.sets).toBeGreaterThanOrEqual(2);
          expect(Number(s.repRange.split("-")[0])).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });
});

describe("selectForBlock", () => {
  const chest = [
    ex({ id: "bench", tier: "S", role: "opener_heavy", substitution_group: "chest_horizontal_press", true_max_effort: true }),
    ex({ id: "incline", tier: "S", role: "opener_heavy", substitution_group: "chest_incline_press" }),
    ex({ id: "dip", tier: "S", role: "opener_compound", substitution_group: "chest_chest_dip" }),
    ex({ id: "db-bench", tier: "S", role: "opener_compound", substitution_group: "chest_horizontal_press" }),
    ex({ id: "fly", tier: "A", role: "mid_isolation", substitution_group: "chest_chest_fly" }),
    ex({ id: "band-press", tier: "B", role: "finisher_compound", substitution_group: "chest_horizontal_press" }),
  ];

  it("does not pick two exercises from the same substitution_group when alternatives exist", () => {
    // Would have been Bench + DB Bench (same group); should be Bench + Incline.
    const out = selectForBlock(chest, 2, ["S", "A"]);
    expect(out.map((c) => c.id)).toEqual(["bench", "incline"]);
  });

  it("prefers tier quality over role diversity on a small block", () => {
    // Old reservation would pick Bench (S opener_heavy) + Band Press (B
    // finisher_compound) to satisfy 'opener + finisher'. Correct behaviour:
    // pick the two best by tier that live in different groups.
    const out = selectForBlock(chest, 2, ["S", "A"]);
    expect(out.every((c) => c.tier === "S")).toBe(true);
  });

  it("takes the best opener at one slot", () => {
    expect(selectForBlock(chest, 1, ["S", "A"])[0].id).toBe("bench");
  });

  it("falls back to same-group when the pool is too small for variety", () => {
    const twoInSameGroup = [
      ex({ id: "a", tier: "S", role: "opener_heavy", substitution_group: "g1" }),
      ex({ id: "b", tier: "A", role: "opener_compound", substitution_group: "g1" }),
    ];
    // Only one group available; block must still fill.
    expect(selectForBlock(twoInSameGroup, 2, ["S", "A"])).toHaveLength(2);
  });

  it("never returns more than the pool holds", () => {
    expect(selectForBlock(chest, 99, ["S", "A"])).toHaveLength(chest.length);
  });

  it("still fills isolation-only pools (core, forearms, calves)", () => {
    const isoOnly = [
      ex({ id: "a", tier: "S", role: "mid_isolation", substitution_group: "g1" }),
      ex({ id: "b", tier: "A", role: "mid_isolation", substitution_group: "g2" }),
    ];
    expect(selectForBlock(isoOnly, 2, ["S", "A"])).toHaveLength(2);
  });

  it("caps barbell compounds at 1 per block — no Bench + Incline Barbell", () => {
    const chestBarbells = [
      ex({ id: "bench", tier: "S", role: "opener_heavy", equipment: "barbell", substitution_group: "chest_horizontal_press" }),
      ex({ id: "incline-bb", tier: "S", role: "opener_heavy", equipment: "barbell", substitution_group: "chest_incline_press" }),
      ex({ id: "dip", tier: "S", role: "opener_compound", equipment: "bodyweight", substitution_group: "chest_chest_dip" }),
      ex({ id: "incline-db", tier: "S", role: "opener_compound", equipment: "dumbbell", substitution_group: "chest_incline_press" }),
    ];
    const out = selectForBlock(chestBarbells, 3, ["S", "A"]);
    expect(out.filter((c) => c.equipment === "barbell").length).toBeLessThanOrEqual(1);
    expect(out.map((c) => c.id)).toContain("bench");
  });

  it("falls back to two barbell compounds if that is all the pool offers", () => {
    const barbellOnly = [
      ex({ id: "a", tier: "S", role: "opener_heavy", equipment: "barbell", substitution_group: "g1" }),
      ex({ id: "b", tier: "A", role: "opener_compound", equipment: "barbell", substitution_group: "g2" }),
    ];
    expect(selectForBlock(barbellOnly, 2, ["S", "A"])).toHaveLength(2);
  });

  it("does not restrict non-barbell equipment", () => {
    // Two dumbbell compounds is fine — the cap is barbell-specific.
    const dbOnly = [
      ex({ id: "a", tier: "S", role: "opener_compound", equipment: "dumbbell", substitution_group: "g1" }),
      ex({ id: "b", tier: "S", role: "opener_compound", equipment: "dumbbell", substitution_group: "g2" }),
    ];
    expect(selectForBlock(dbOnly, 2, ["S", "A"])).toHaveLength(2);
  });
});

describe("orderBlock", () => {
  it("runs openers before finishers", () => {
    const out = orderBlock([
      ex({ id: "fin", role: "finisher_isolation" }),
      ex({ id: "open", role: "opener_heavy", true_max_effort: true }),
      ex({ id: "mid", role: "mid_compound" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["open", "mid", "fin"]);
  });

  it("orders shoulders rear -> side -> press for pre-exhaustion", () => {
    const out = orderBlock([
      ex({ id: "press", primary_muscle: "shoulders", role: "mid_compound", sub_target: "press_region" }),
      ex({ id: "side", primary_muscle: "shoulders", role: "mid_isolation", sub_target: "side_delt_region" }),
      ex({ id: "rear", primary_muscle: "shoulders", role: "opener_isolation", sub_target: "rear_delt_region" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["rear", "side", "press"]);
  });

  it("puts a true_max_effort press FIRST instead, overriding pre-exhaustion", () => {
    const out = orderBlock([
      ex({ id: "rear", primary_muscle: "shoulders", role: "opener_isolation", sub_target: "rear_delt_region" }),
      ex({ id: "ohp", primary_muscle: "shoulders", role: "opener_heavy", sub_target: "press_region", true_max_effort: true }),
    ]);
    expect(out[0].id).toBe("ohp");
  });
});

describe("orderDay", () => {
  it("trains large muscles before small, core last", () => {
    const out = orderDay([
      ex({ id: "crunch", primary_muscle: "core", role: "finisher_isolation" }),
      ex({ id: "curl", primary_muscle: "biceps", role: "mid_isolation" }),
      ex({ id: "row", primary_muscle: "back", role: "opener_compound" }),
    ]);
    expect(out.map((c) => c.primary_muscle)).toEqual(["back", "biceps", "core"]);
  });

  it("puts calves after the other leg muscles but before core", () => {
    const out = orderDay([
      ex({ id: "core1", primary_muscle: "core", role: "mid_isolation" }),
      ex({ id: "calf", primary_muscle: "calves", role: "mid_isolation" }),
      ex({ id: "squat", primary_muscle: "quads", role: "opener_heavy" }),
    ]);
    expect(out.map((c) => c.primary_muscle)).toEqual(["quads", "calves", "core"]);
  });

  it("does NOT promote a true_max_effort lift across muscle blocks", () => {
    // Back Squat (quads, opener_heavy, MAX) must lead the Legs day even
    // though Hip Thrust (glutes) is technically also true_max_effort. Large
    // muscles come first; global promotion is not stronger than that.
    const out = orderDay([
      ex({ id: "hip-thrust", primary_muscle: "glutes", role: "opener_heavy", true_max_effort: true }),
      ex({ id: "back-squat", primary_muscle: "quads", role: "opener_heavy", true_max_effort: true }),
    ]);
    expect(out.map((c) => c.primary_muscle)).toEqual(["quads", "glutes"]);
    expect(out[0].id).toBe("back-squat");
  });

  it("never leaves a true_max_effort lift last", () => {
    const out = orderDay([
      ex({ id: "curl", primary_muscle: "biceps", role: "mid_isolation" }),
      ex({ id: "dl", primary_muscle: "back", role: "opener_heavy", true_max_effort: true }),
      ex({ id: "crunch", primary_muscle: "core", role: "finisher_isolation" }),
    ]);
    expect(out[out.length - 1].true_max_effort).toBe(false);
  });

  it("swaps a max-effort lift back one step when it would otherwise close the day", () => {
    // Contrived case: max-effort lift is on the last-ordered muscle. It should
    // still not close the day.
    const out = orderDay([
      ex({ id: "crunch", primary_muscle: "core", role: "opener_heavy", true_max_effort: true }),
      ex({ id: "curl", primary_muscle: "biceps", role: "mid_isolation" }),
    ]);
    expect(out[out.length - 1].id).not.toBe("crunch");
  });
});
