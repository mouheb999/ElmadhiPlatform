import { describe, expect, it } from "vitest";
import { canTrainAt, dayPlan, nextTrainingDay, weekPlan } from "./schedule";
import { type ClinicalProfile } from "./types";

/** Mon/Wed/Sat, 07:30, four hours — the schedule this module was built for. */
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

// 2026-09-07 is a Monday.
const MON = "2026-09-07";
const TUE = "2026-09-08";
const WED = "2026-09-09";
const THU = "2026-09-10";
const FRI = "2026-09-11";
const SAT = "2026-09-12";
const SUN = "2026-09-13";

describe("dayPlan", () => {
  it("types a session day as dialysis", () => {
    expect(dayPlan(profile(), MON).type).toBe("dialysis");
    expect(dayPlan(profile(), WED).type).toBe("dialysis");
    expect(dayPlan(profile(), SAT).type).toBe("dialysis");
  });

  it("gives no window on a 07:30 session day — the pre-session buffer eats the morning", () => {
    // Buffer opens the window's close at 03:30, and the day starts at 00:00:
    // three and a half hours of night is not a training window.
    const plan = dayPlan(profile(), MON);
    expect(plan.window).not.toBeNull();
    expect(plan.window!.closesAt.toISOString()).toBe("2026-09-07T02:30:00.000Z"); // 03:30 Tunis
    expect(plan.reasonKey).toBe("care.reason_before_session");
  });

  it("closes the morning after a session and opens the afternoon", () => {
    // Monday's run ends 11:30 Tunis; 24h of recovery reaches Tuesday 11:30.
    const plan = dayPlan(profile(), TUE);
    expect(plan.type).toBe("training");
    expect(plan.window!.opensAt.toISOString()).toBe("2026-09-08T10:30:00.000Z"); // 11:30 Tunis
    expect(plan.reasonKey).toBe("care.reason_after_recovery");
  });

  it("keeps the day before a session clear of the buffer", () => {
    // Friday is an off-day, but Saturday's 07:30 session pulls its buffer back
    // to 03:30 Saturday — which does not reach into Friday at all.
    const plan = dayPlan(profile(), FRI);
    expect(plan.type).toBe("training");
    expect(plan.window!.closesAt.toISOString()).toBe("2026-09-11T23:00:00.000Z"); // Sat 00:00 Tunis
  });

  it("calls a whole day recovery when the window never opens", () => {
    // Saturday's run ends 11:30; 48 hours of recovery reaches Monday 11:30,
    // so Sunday never opens at all. (36 would leave a half-hour sliver before
    // midnight, and the window logic would rightly still offer it.)
    const plan = dayPlan(profile({ postSessionRecoveryHours: 48 }), SUN);
    expect(plan.type).toBe("recovery");
    expect(plan.window).toBeNull();
  });

  it("refuses to type anything when the schedule is not on file", () => {
    const plan = dayPlan(profile({ dialysisDays: [] }), TUE);
    expect(plan.type).toBe("unknown");
    expect(plan.window).toBeNull();
    expect(plan.reasonKey).toBe("care.reason_schedule_missing");
  });

  it("closes a session day entirely when the unit's time is unknown", () => {
    const plan = dayPlan(profile({ dialysisStartTime: null }), MON);
    expect(plan.type).toBe("dialysis");
    expect(plan.window).toBeNull();
    expect(plan.reasonKey).toBe("care.reason_session_time_missing");
  });

  it("treats a day after an untimed session day as fully recovering", () => {
    // No start time means the conservative reading: the session ran to
    // midnight, so 24h of recovery covers all of Tuesday.
    const plan = dayPlan(profile({ dialysisStartTime: null }), TUE);
    expect(plan.type).toBe("recovery");
  });

  it("leaves a non-dialysis user's days alone", () => {
    const plan = dayPlan(profile({ conditions: ["hypertension"], dialysisDays: [] }), TUE);
    expect(plan.type).toBe("training");
    expect(plan.window).not.toBeNull();
  });

  it("has nothing to say with no care profile at all", () => {
    expect(dayPlan(null, TUE).type).toBe("training");
  });
});

describe("canTrainAt", () => {
  const p = profile();

  it("says no during the session itself", () => {
    const result = canTrainAt(p, new Date("2026-09-07T08:00:00Z")); // 09:00 Tunis, Monday
    expect(result.allowed).toBe(false);
    expect(result.reasonKey).toBe("care.reason_too_close_to_session");
  });

  it("says no on the morning after", () => {
    const result = canTrainAt(p, new Date("2026-09-08T07:00:00Z")); // 08:00 Tunis, Tuesday
    expect(result.allowed).toBe(false);
    expect(result.reasonKey).toBe("care.reason_window_not_open");
  });

  it("says yes in the Tuesday afternoon window", () => {
    const result = canTrainAt(p, new Date("2026-09-08T15:00:00Z")); // 16:00 Tunis
    expect(result.allowed).toBe(true);
  });

  it("says yes on a clear off-day", () => {
    expect(canTrainAt(p, new Date("2026-09-10T15:00:00Z")).allowed).toBe(true); // Thursday
  });
});

describe("nextTrainingDay", () => {
  it("skips forward past the dialysis day and its recovery", () => {
    const plan = nextTrainingDay(profile(), MON);
    // Monday has a (nocturnal, unusable in practice) pre-session window, so the
    // first day the function offers is Monday itself — the caller compares the
    // window against the clock. From Tuesday's dialysis-free morning it is Tuesday.
    expect(plan!.dateKey).toBe(MON);
    expect(nextTrainingDay(profile(), TUE)!.dateKey).toBe(TUE);
    expect(nextTrainingDay(profile(), WED)!.dateKey).toBe(WED);
  });

  it("returns null rather than guessing when the schedule is missing", () => {
    expect(nextTrainingDay(profile({ dialysisDays: [] }), MON)).toBeNull();
  });
});

describe("weekPlan", () => {
  it("lays out Monday to Sunday", () => {
    const week = weekPlan(profile(), MON);
    expect(week.map((d) => d.type)).toEqual([
      "dialysis", // Mon
      "training", // Tue
      "dialysis", // Wed
      "training", // Thu
      "training", // Fri
      "dialysis", // Sat
      "training", // Sun
    ]);
    expect(week.map((d) => d.dateKey)).toEqual([MON, TUE, WED, THU, FRI, SAT, SUN]);
  });
});
