import { describe, expect, it } from "vitest";
import {
  accessRestriction,
  exerciseAllowed,
  judgeBloodPressure,
  judgeGlucose,
  lowerBodyPermission,
  outstandingClearances,
  sessionReadiness,
  sessionShape,
} from "./gates";
import { fromMgdl, toMgdl, type ClinicalProfile } from "./types";

function profile(overrides: Partial<ClinicalProfile> = {}): ClinicalProfile {
  return {
    id: "cp",
    userId: "u",
    conditions: ["dialysis", "diabetes_insulin", "hypertension"],
    dialysisDays: [1, 3, 6],
    dialysisStartTime: "07:30",
    dialysisDurationMinutes: 240,
    postSessionRecoveryHours: 24,
    preSessionBufferHours: 4,
    vascularAccess: "fistula_left",
    weightBearing: "unknown",
    weightBearingSource: null,
    weightBearingDatedOn: null,
    bpClearance: "unknown",
    bpSkipAboveSystolic: null,
    bpSkipAboveDiastolic: null,
    bpClearedBy: null,
    bpClearedOn: null,
    glucoseFloorMgdl: null,
    glucoseCeilingMgdl: null,
    glucoseDisplayUnit: "g_l",
    glucoseSetBy: null,
    glucoseSetOn: null,
    sessionMinMinutes: 15,
    sessionMaxMinutes: 25,
    restSecondsMin: 120,
    effortCeiling: 4,
    seatedOrSupportedOnly: true,
    notes: null,
    ...overrides,
  };
}

describe("lowerBodyPermission", () => {
  it("treats a missing orthopedist line exactly like a 'no'", () => {
    const unknown = lowerBodyPermission(profile({ weightBearing: "unknown" }));
    const none = lowerBodyPermission(profile({ weightBearing: "none" }));
    expect(unknown.loaded).toBe(none.loaded);
    expect(unknown.seatedUnloaded).toBe(none.seatedUnloaded);
    expect(unknown.standing).toBe(none.standing);
    // …and differs only in who it is waiting on.
    expect(unknown.gate.waitingOn).toBe("orthopedist");
    expect(none.gate.waitingOn).toBeNull();
  });

  it("opens seated and standing work at partial, but not external load", () => {
    const partial = lowerBodyPermission(profile({ weightBearing: "partial" }));
    expect(partial.loaded).toBe(false);
    expect(partial.seatedUnloaded).toBe(true);
    expect(partial.standing).toBe(true);
  });

  it("opens everything at full", () => {
    const full = lowerBodyPermission(profile({ weightBearing: "full" }));
    expect(full.loaded && full.seatedUnloaded && full.standing).toBe(true);
    expect(full.gate.level).toBe("open");
  });
});

describe("exerciseAllowed", () => {
  const seatedRow = { primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "machine" };
  const legPress = { primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine" };

  it("lets upper-body seated work through with no clearance at all", () => {
    expect(exerciseAllowed(profile(), seatedRow).level).toBe("open");
  });

  it("blocks loaded leg work until the orthopedist has spoken", () => {
    expect(exerciseAllowed(profile(), legPress).level).toBe("blocked");
    expect(exerciseAllowed(profile({ weightBearing: "full" }), legPress).level).toBe("open");
  });

  it("catches a leg movement hiding behind an upper-body primary muscle", () => {
    const standingPress = {
      primaryMuscle: "shoulders",
      secondaryMuscles: ["quads", "core"],
      equipment: "dumbbell",
    };
    expect(exerciseAllowed(profile(), standingPress).level).toBe("blocked");
  });

  it("blocks a standing-only movement while the session is seated-only", () => {
    const standingCalf = {
      primaryMuscle: "chest",
      secondaryMuscles: [],
      equipment: "bodyweight",
      requiresStanding: true,
    };
    expect(exerciseAllowed(profile({ weightBearing: "full" }), standingCalf).level).toBe("blocked");
    expect(
      exerciseAllowed(
        profile({ weightBearing: "full", seatedOrSupportedOnly: false }),
        standingCalf,
      ).level,
    ).toBe("open");
  });
});

describe("sessionShape", () => {
  it("caps hardest when nobody has cleared him", () => {
    const shape = sessionShape(profile({ bpClearance: "unknown" }));
    expect(shape.effortCeiling).toBe(2);
    expect(shape.maxMinutes).toBe(15);
    expect(shape.seatedOnly).toBe(true);
    expect(shape.gate.waitingOn).toBe("cardiologist");
  });

  it("blocks outright when a clinician has said no", () => {
    expect(sessionShape(profile({ bpClearance: "not_cleared" })).gate.level).toBe("blocked");
  });

  it("honours the profile's own ceiling once cleared for moderate", () => {
    const shape = sessionShape(profile({ bpClearance: "moderate" }));
    expect(shape.effortCeiling).toBe(4);
    expect(shape.maxMinutes).toBe(25);
    expect(shape.gate.level).toBe("open");
  });

  it("never lets a light-only clearance be widened by the profile's numbers", () => {
    const shape = sessionShape(
      profile({ bpClearance: "light_only", effortCeiling: 9, sessionMaxMinutes: 60 }),
    );
    expect(shape.effortCeiling).toBe(3);
    expect(shape.maxMinutes).toBe(20);
  });
});

describe("judgeGlucose", () => {
  const withRange = profile({ glucoseFloorMgdl: 100, glucoseCeilingMgdl: 250 });

  it("refuses to judge without a range, and never calls it in-range", () => {
    const verdict = judgeGlucose(profile(), 140);
    expect(verdict.outcome).toBe("unjudged");
    expect(verdict.waitingOn).toBe("diabetologist");
    expect(verdict.level).not.toBe("open");
  });

  it("blocks below the floor and above the ceiling", () => {
    expect(judgeGlucose(withRange, 80).outcome).toBe("below_range");
    expect(judgeGlucose(withRange, 80).level).toBe("blocked");
    expect(judgeGlucose(withRange, 300).outcome).toBe("above_range");
    expect(judgeGlucose(withRange, 300).level).toBe("blocked");
  });

  it("passes inside the range, boundaries included", () => {
    expect(judgeGlucose(withRange, 100).outcome).toBe("in_range");
    expect(judgeGlucose(withRange, 250).outcome).toBe("in_range");
  });
});

describe("judgeBloodPressure", () => {
  it("refuses to judge with no threshold on file", () => {
    expect(judgeBloodPressure(profile(), 180, 110).outcome).toBe("unjudged");
  });

  it("blocks over either threshold on its own", () => {
    const p = profile({ bpSkipAboveSystolic: 160, bpSkipAboveDiastolic: 100 });
    expect(judgeBloodPressure(p, 170, 90).outcome).toBe("above_range");
    expect(judgeBloodPressure(p, 130, 105).outcome).toBe("above_range");
    expect(judgeBloodPressure(p, 150, 95).outcome).toBe("in_range");
  });
});

describe("glucose units", () => {
  it("converts the g/L a Tunisian meter shows into the mg/dL we store", () => {
    expect(toMgdl(1.2, "g_l")).toBe(120);
    expect(toMgdl(120, "mg_dl")).toBe(120);
    expect(toMgdl(6.7, "mmol_l")).toBe(121);
  });

  it("round-trips back into the unit he reads", () => {
    expect(fromMgdl(120, "g_l")).toBe(1.2);
    expect(fromMgdl(121, "mmol_l")).toBe(6.7);
  });
});

describe("accessRestriction", () => {
  it("names the fistula arm and warns about both load and cuffs", () => {
    const r = accessRestriction(profile({ vascularAccess: "fistula_left" }));
    expect(r).toMatchObject({ arm: "left", cuffWarning: true, loadWarning: true });
  });

  it("warns on both counts while the access is unrecorded", () => {
    const r = accessRestriction(profile({ vascularAccess: "unknown" }));
    expect(r.arm).toBe("unknown");
    expect(r.cuffWarning).toBe(true);
  });

  it("stays quiet for a neck catheter, which restricts no arm", () => {
    expect(accessRestriction(profile({ vascularAccess: "catheter" })).cuffWarning).toBe(false);
  });
});

describe("sessionReadiness", () => {
  const cleared = profile({
    bpClearance: "moderate",
    bpSkipAboveSystolic: 160,
    bpSkipAboveDiastolic: 100,
    glucoseFloorMgdl: 100,
    glucoseCeilingMgdl: 250,
    weightBearing: "full",
  });

  it("will not start a session for an insulin user with no reading taken", () => {
    const r = sessionReadiness(cleared, { glucoseMgdl: null, bp: { systolic: 130, diastolic: 80 } });
    expect(r.allowed).toBe(false);
    expect(r.blockers.map((b) => b.key)).toContain("care.glucose_not_taken");
  });

  it("starts when both readings are in range", () => {
    const r = sessionReadiness(cleared, {
      glucoseMgdl: 140,
      bp: { systolic: 130, diastolic: 80 },
    });
    expect(r.allowed).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("stops on a low glucose", () => {
    const r = sessionReadiness(cleared, { glucoseMgdl: 70, bp: { systolic: 130, diastolic: 80 } });
    expect(r.allowed).toBe(false);
    expect(r.blockers.map((b) => b.key)).toContain("care.glucose_below");
  });

  it("keeps the leg gate a warning, not a blocker — upper body still trains today", () => {
    const r = sessionReadiness(
      { ...cleared, weightBearing: "unknown" },
      { glucoseMgdl: 140, bp: { systolic: 130, diastolic: 80 } },
    );
    expect(r.allowed).toBe(true);
    expect(r.warnings.map((w) => w.key)).toContain("care.wb_unknown");
  });

  it("demands a BP reading while the clearance is missing", () => {
    const r = sessionReadiness(profile({ glucoseFloorMgdl: 100, glucoseCeilingMgdl: 250 }), {
      glucoseMgdl: 140,
      bp: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.map((b) => b.key)).toContain("care.bp_not_taken");
  });

  it("ignores glucose for someone who is not on insulin", () => {
    const r = sessionReadiness(
      { ...cleared, conditions: ["hypertension"] },
      { glucoseMgdl: null, bp: { systolic: 130, diastolic: 80 } },
    );
    expect(r.allowed).toBe(true);
  });
});

describe("outstandingClearances", () => {
  it("lists every letter still missing, and nothing else", () => {
    expect(outstandingClearances(profile({ vascularAccess: "fistula_left" })).map((c) => c.waitingOn))
      .toEqual(["orthopedist", "cardiologist", "diabetologist"]);
  });

  it("empties out once every clinician has answered", () => {
    const complete = profile({
      weightBearing: "full",
      bpClearance: "moderate",
      bpSkipAboveSystolic: 160,
      bpSkipAboveDiastolic: 100,
      glucoseFloorMgdl: 100,
      glucoseCeilingMgdl: 250,
      vascularAccess: "fistula_left",
    });
    expect(outstandingClearances(complete)).toEqual([]);
  });

  it("asks the unit for the schedule and the access when they are missing", () => {
    const p = profile({ dialysisDays: [], vascularAccess: "unknown" });
    expect(outstandingClearances(p).filter((c) => c.waitingOn === "dialysis_unit")).toHaveLength(2);
  });
});

describe("scoping — a care file only carries the gates it is about", () => {
  it("leaves the effort cap alone for a file with no blood-pressure question in it", () => {
    const orthoOnly = profile({
      conditions: [],
      bpClearance: "unknown",
      effortCeiling: 6,
      sessionMaxMinutes: 30,
    });
    const shape = sessionShape(orthoOnly);
    expect(shape.effortCeiling).toBe(6);
    expect(shape.maxMinutes).toBe(30);
    expect(shape.gate.level).toBe("open");
  });

  it("does not chase a clearance nobody needs", () => {
    const orthoOnly = profile({ conditions: [], weightBearing: "full" });
    expect(outstandingClearances(orthoOnly)).toEqual([]);
  });

  it("still caps a dialysis patient with no hypertension diagnosis on file", () => {
    const dialysisOnly = profile({ conditions: ["dialysis"], bpClearance: "unknown" });
    expect(sessionShape(dialysisOnly).effortCeiling).toBe(2);
  });
});
