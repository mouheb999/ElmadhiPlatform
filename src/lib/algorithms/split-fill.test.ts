import { describe, it, expect } from "vitest";
import {
  resolveSplitId,
  resolveEquipmentValues,
  isQuestionVisible,
  requiresHomeFriendly,
  expandDislikes,
  filterCandidates,
  rankByTier,
  scaleSlotsForDuration,
  applyBodyFocusBoost,
  fillDay,
  generateProgram,
  repSchemeFor,
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
  ...over,
});

const slot = (over: Partial<Slot> & { primary_muscle: string }): Slot => ({
  exercise_slots: 1,
  preferred_tiers: ["S", "A"],
  order_index: 0,
  ...over,
});

const ALL_EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "band", "plate"];
const NO_LIMITS = { equipment: ALL_EQUIPMENT, injuries: [], dislikes: [] };

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
});

describe("scaleSlotsForDuration", () => {
  it("is a no-op at factor 1", () => {
    const slots = [slot({ primary_muscle: "chest", exercise_slots: 3 })];
    expect(scaleSlotsForDuration(slots, 1)).toBe(slots);
  });

  it("hits the rounded total exactly rather than rounding each slot", () => {
    // Seven 1-slot muscles at x1.4 => target 10. Per-slot rounding would give 7.
    const slots = Array.from({ length: 7 }, (_, i) =>
      slot({ primary_muscle: `m${i}`, exercise_slots: 1, order_index: i }),
    );
    const out = scaleSlotsForDuration(slots, 1.4);
    expect(out.reduce((n, s) => n + s.exercise_slots, 0)).toBe(10);
  });

  it("scales a realistic PPL push day up", () => {
    const slots = [
      slot({ primary_muscle: "chest", exercise_slots: 3, order_index: 0 }),
      slot({ primary_muscle: "shoulders", exercise_slots: 2, order_index: 1 }),
      slot({ primary_muscle: "triceps", exercise_slots: 2, order_index: 2 }),
    ];
    const out = scaleSlotsForDuration(slots, 1.4);
    expect(out.reduce((n, s) => n + s.exercise_slots, 0)).toBe(10); // round(7 * 1.4)
  });

  it("scales down for short sessions but never below one per slot", () => {
    const slots = [
      slot({ primary_muscle: "chest", exercise_slots: 1, order_index: 0 }),
      slot({ primary_muscle: "back", exercise_slots: 1, order_index: 1 }),
      slot({ primary_muscle: "legs", exercise_slots: 1, order_index: 2 }),
    ];
    const out = scaleSlotsForDuration(slots, 0.7);
    expect(out.every((s) => s.exercise_slots >= 1)).toBe(true);
  });

  it("reduces total volume at 0.7 on a larger day", () => {
    const slots = [
      slot({ primary_muscle: "legs", exercise_slots: 5, order_index: 0 }),
      slot({ primary_muscle: "core", exercise_slots: 2, order_index: 1 }),
    ];
    const out = scaleSlotsForDuration(slots, 0.7);
    expect(out.reduce((n, s) => n + s.exercise_slots, 0)).toBe(5); // round(7 * 0.7)
  });
});

describe("applyBodyFocusBoost", () => {
  const rules = {
    Arms: { muscle_group: ["Biceps", "Triceps"], add_slots: 1 },
    Chest: { muscle_group: "Chest", add_slots: 1 },
    "Abs / core": { muscle_group: "Core", add_slots: 1 },
  };

  it("adds a slot to the focused muscle", () => {
    const slots = [slot({ primary_muscle: "chest", exercise_slots: 3 })];
    expect(applyBodyFocusBoost(slots, ["Chest"], rules)[0].exercise_slots).toBe(4);
  });

  it("boosts both muscles for Arms", () => {
    const slots = [
      slot({ primary_muscle: "biceps", exercise_slots: 2, order_index: 0 }),
      slot({ primary_muscle: "triceps", exercise_slots: 2, order_index: 1 }),
    ];
    const out = applyBodyFocusBoost(slots, ["Arms"], rules);
    expect(out.map((s) => s.exercise_slots)).toEqual([3, 3]);
  });

  it("never introduces a muscle the day does not already train", () => {
    const slots = [slot({ primary_muscle: "chest", exercise_slots: 3 })];
    const out = applyBodyFocusBoost(slots, ["Abs / core"], rules);
    expect(out).toHaveLength(1);
    expect(out[0].primary_muscle).toBe("chest");
  });

  it("is a no-op with no focus selected", () => {
    const slots = [slot({ primary_muscle: "chest", exercise_slots: 3 })];
    expect(applyBodyFocusBoost(slots, [], rules)).toBe(slots);
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
    const out = fillDay(day, pool, NO_LIMITS);
    expect(out.picks.map((p) => p.exerciseId)).toEqual(["c1", "c2", "t1"]);
    expect(out.unfilled).toEqual([]);
  });

  it("never picks the same exercise twice in a day", () => {
    const out = fillDay(day, pool, NO_LIMITS);
    expect(new Set(out.picks.map((p) => p.exerciseId)).size).toBe(out.picks.length);
  });

  it("assigns a contiguous order_index across slots", () => {
    const out = fillDay(day, pool, NO_LIMITS);
    expect(out.picks.map((p) => p.order_index)).toEqual([0, 1, 2]);
  });

  it("reports a short slot instead of silently shrinking the day", () => {
    const thin = [ex({ id: "c1", primary_muscle: "chest", tier: "S" })];
    const out = fillDay(day, thin, NO_LIMITS);
    expect(out.picks).toHaveLength(1);
    expect(out.unfilled).toEqual([
      { primary_muscle: "chest", requested: 2, filled: 1 },
      { primary_muscle: "triceps", requested: 1, filled: 0 },
    ]);
  });

  it("reports every slot unfilled when injuries eliminate the pool", () => {
    const out = fillDay(day, pool, { ...NO_LIMITS, injuries: ["Shoulder"] });
    expect(out.picks).toHaveLength(3); // nothing in this pool is contraindicated
    const injured = fillDay(
      day,
      pool.map((c) => ({ ...c, contraindicated_for: ["Shoulder"] })),
      { ...NO_LIMITS, injuries: ["Shoulder"] },
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

  const base = {
    ...NO_LIMITS,
    durationFactor: 1,
    bodyFocus: [] as string[],
    bodyFocusRules: { Chest: { muscle_group: "Chest", add_slots: 1 } },
  };

  it("fills every day of the split", () => {
    const out = generateProgram(days, pool, base);
    expect(out).toHaveLength(2);
    expect(out.flatMap((d) => d.picks)).toHaveLength(4);
  });

  it("lets an explicit body focus survive a short-session downscale", () => {
    const out = generateProgram(days, pool, { ...base, durationFactor: 0.7, bodyFocus: ["Chest"] });
    const push = out.find((d) => d.day_name_en === "Push")!;
    // boosted 2 -> 3, then scaled x0.7 -> 2; without the boost it would be 1.
    expect(push.picks.length).toBeGreaterThan(1);
  });

  it("allows the same exercise on different days", () => {
    const twoPushDays = [days[0], { ...days[0], day_number: 2 }];
    const out = generateProgram(twoPushDays, pool, base);
    expect(out[0].picks[0].exerciseId).toBe(out[1].picks[0].exerciseId);
  });
});

describe("repSchemeFor", () => {
  it("lets an explicit training style override the goal", () => {
    expect(repSchemeFor({ goal: "Fat loss", trainingStyle: "Heavy weight, low reps (strength feel)" })).toEqual({
      sets: 4,
      repRange: "4-6",
      restSeconds: 150,
    });
  });

  it("falls back to the goal default when the user is not sure", () => {
    expect(repSchemeFor({ goal: "Strength", trainingStyle: "Not sure — let my goal decide" }).repRange).toBe("4-6");
  });

  it("uses higher reps for fat loss", () => {
    expect(repSchemeFor({ goal: "Fat loss" }).repRange).toBe("10-15");
  });

  it("defaults to hypertrophy rep ranges", () => {
    expect(repSchemeFor({ goal: "Muscle growth (hypertrophy)" }).repRange).toBe("8-12");
  });
});
