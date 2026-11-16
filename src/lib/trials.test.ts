import { describe, expect, it } from "vitest";
import { summarizeTrials, trialDaysLeft, trialStatus, type TrialProfile } from "./trials";

// Noon in Tunis (UTC+1) on 15 Nov 2026, so day boundaries are unambiguous.
const NOW = new Date("2026-11-15T11:00:00Z");
const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString();

let seq = 0;
function trial(overrides: Partial<TrialProfile> & { createdDaysAgo?: number } = {}): TrialProfile {
  const { createdDaysAgo = 0, ...rest } = overrides;
  return {
    id: `u${seq++}`,
    created_at: at(-createdDaysAgo),
    free_access_until: at(-createdDaysAgo + 3),
    payment_status: "unpaid",
    paid_at: null,
    ...rest,
  };
}

describe("trialStatus", () => {
  it("is active inside the three days and ended after", () => {
    expect(trialStatus(trial({ createdDaysAgo: 1 }), NOW)).toBe("active");
    expect(trialStatus(trial({ createdDaysAgo: 4 }), NOW)).toBe("ended");
  });

  it("reads a window closed at sign-up as a blocked repeat, not a trial", () => {
    const created = at(-1);
    const closedAt = new Date(Date.parse(created) + 5_000).toISOString();
    expect(trialStatus(trial({ created_at: created, free_access_until: closedAt }), NOW)).toBe(
      "blocked",
    );
  });

  it("puts payment ahead of everything else", () => {
    expect(trialStatus(trial({ payment_status: "active" }), NOW)).toBe("paid");
    expect(trialStatus(trial({ createdDaysAgo: 5, paid_at: at(-1) }), NOW)).toBe("paid");
    expect(trialStatus(trial({ payment_status: "pending" }), NOW)).toBe("paying");
  });
});

describe("trialDaysLeft", () => {
  it("rounds up and is null once closed", () => {
    expect(trialDaysLeft(trial({ createdDaysAgo: 0 }), NOW)).toBe(3);
    expect(trialDaysLeft(trial({ createdDaysAgo: 2.5 }), NOW)).toBe(1);
    expect(trialDaysLeft(trial({ createdDaysAgo: 4 }), NOW)).toBeNull();
  });
});

describe("summarizeTrials", () => {
  it("counts started trials by period and leaves blocked repeats out", () => {
    const created = at(0);
    const rows = [
      trial({ createdDaysAgo: 0 }),
      trial({ createdDaysAgo: 0, payment_status: "active" }),
      trial({ createdDaysAgo: 3 }),
      trial({ createdDaysAgo: 10 }),
      trial({ created_at: created, free_access_until: created }), // blocked
      { id: "old", created_at: at(-40), free_access_until: null, payment_status: "unpaid" },
    ];
    const s = summarizeTrials(rows, NOW);
    expect(s.started).toEqual({ today: 2, week: 3, month: 4, total: 4 });
    expect(s.byStatus.blocked).toBe(1);
    expect(s.byStatus.paid).toBe(1);
    expect(s.conversionPct).toBe(25);
  });

  it("starts the daily series at the first trial and ends today", () => {
    const s = summarizeTrials([trial({ createdDaysAgo: 4 }), trial({ createdDaysAgo: 0 })], NOW);
    expect(s.daily.map((d) => d.count)).toEqual([1, 0, 0, 0, 1]);
    expect(s.daily.at(-1)?.date).toBe("2026-11-15");
  });

  it("caps the series at the requested number of days", () => {
    const s = summarizeTrials([trial({ createdDaysAgo: 60 })], NOW, 30);
    expect(s.daily).toHaveLength(30);
    expect(s.started.total).toBe(1);
    expect(s.started.month).toBe(0);
  });

  it("is empty before the first trial", () => {
    const s = summarizeTrials([], NOW);
    expect(s.daily).toEqual([]);
    expect(s.conversionPct).toBeNull();
  });
});
