import { describe, expect, it } from "vitest";
import { applyProgression, nextProgression, type SessionRecord } from "./progression";

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    dateKey: "2026-09-08",
    felt: "good",
    stoppedEarly: false,
    perceivedEffort: 3,
    nextDayRecovery: "recovered",
    symptoms: [],
    ...overrides,
  };
}

const cleanRun = [session(), session(), session()];

describe("nextProgression", () => {
  it("stops everything on a red-flag symptom, however mild it was called", () => {
    const decision = nextProgression(
      [session({ symptoms: [{ symptom: "chest_discomfort", severity: "mild" }] }), ...cleanRun],
      false,
    );
    expect(decision.step).toBe("stop_and_review");
    expect(decision.triggeredBy).toContain("chest_discomfort");
  });

  it("stops on any severe symptom, red flag or not", () => {
    const decision = nextProgression(
      [session({ symptoms: [{ symptom: "cramps", severity: "severe" }] })],
      false,
    );
    expect(decision.step).toBe("stop_and_review");
  });

  it("keeps a red flag in view for several sessions, not just the last one", () => {
    const history = [
      ...cleanRun,
      session({ symptoms: [{ symptom: "palpitations", severity: "mild" }] }),
    ];
    expect(nextProgression(history, false).step).toBe("stop_and_review");
  });

  it("reduces after a hard stop", () => {
    const decision = nextProgression([session({ stoppedEarly: true }), ...cleanRun], false);
    expect(decision.step).toBe("reduce");
    expect(decision.reasonKey).toBe("care.prog_stopped_early");
  });

  it("reduces when the day after wiped him out", () => {
    expect(
      nextProgression([session({ nextDayRecovery: "wiped_out" }), ...cleanRun], false).step,
    ).toBe("reduce");
  });

  it("reduces on repeated moderate symptoms across the recent window", () => {
    const decision = nextProgression(
      [
        session({ symptoms: [{ symptom: "cramps", severity: "moderate" }] }),
        session({ symptoms: [{ symptom: "dizziness", severity: "moderate" }] }),
        session(),
      ],
      false,
    );
    expect(decision.step).toBe("reduce");
    expect(decision.triggeredBy).toEqual(["cramps", "dizziness"]);
  });

  it("adds minutes after three clean sessions", () => {
    expect(nextProgression(cleanRun, false).step).toBe("add_minutes");
  });

  it("adds an exercise instead once the session is already at its cap", () => {
    expect(nextProgression(cleanRun, true).step).toBe("add_exercise");
  });

  it("holds until there are three sessions to judge", () => {
    expect(nextProgression([session(), session()], false).step).toBe("hold");
    expect(nextProgression([], false).reasonKey).toBe("care.prog_no_history");
  });

  it("holds — never advances — while a recovery answer is still missing", () => {
    const decision = nextProgression(
      [session({ nextDayRecovery: null }), session(), session()],
      false,
    );
    expect(decision.step).toBe("hold");
    expect(decision.reasonKey).toBe("care.prog_awaiting_answers");
  });

  it("holds after a rough session that was still finished", () => {
    expect(nextProgression([session({ felt: "rough" }), ...cleanRun], false).step).toBe("hold");
  });

  it("never advances on load — the only steps that go up are time and volume", () => {
    const steps = [
      nextProgression(cleanRun, false).step,
      nextProgression(cleanRun, true).step,
    ];
    expect(steps).toEqual(["add_minutes", "add_exercise"]);
  });
});

describe("applyProgression", () => {
  const bounds = { minMinutes: 15, maxMinutes: 25 };

  it("adds five minutes and stops at the cap", () => {
    expect(applyProgression("add_minutes", { minutes: 15, exercises: 4 }, bounds)).toEqual({
      minutes: 20,
      exercises: 4,
    });
    expect(applyProgression("add_minutes", { minutes: 23, exercises: 4 }, bounds)).toEqual({
      minutes: 25,
      exercises: 4,
    });
  });

  it("changes one variable at a time", () => {
    expect(applyProgression("add_exercise", { minutes: 25, exercises: 4 }, bounds)).toEqual({
      minutes: 25,
      exercises: 5,
    });
  });

  it("takes both back down on a reduce, without going below the floor", () => {
    expect(applyProgression("reduce", { minutes: 15, exercises: 1 }, bounds)).toEqual({
      minutes: 15,
      exercises: 1,
    });
    expect(applyProgression("reduce", { minutes: 25, exercises: 4 }, bounds)).toEqual({
      minutes: 20,
      exercises: 3,
    });
  });

  it("leaves the session untouched on hold and on stop", () => {
    const current = { minutes: 20, exercises: 3 };
    expect(applyProgression("hold", current, bounds)).toEqual(current);
    expect(applyProgression("stop_and_review", current, bounds)).toEqual(current);
  });
});
