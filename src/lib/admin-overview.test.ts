import { describe, expect, it } from "vitest";
import { dayPart, summarizeRevenue } from "./admin-overview";

// Noon in Tunis on 15 Nov 2026.
const NOW = new Date("2026-11-15T11:00:00Z");

describe("summarizeRevenue", () => {
  it("splits this month from last month, like for like", () => {
    const s = summarizeRevenue(
      [
        { amount_tnd: 89, resolved_at: "2026-11-15T08:00:00Z" },
        { amount_tnd: "39.00", resolved_at: "2026-11-02T10:00:00Z" },
        { amount_tnd: 100, resolved_at: "2026-10-10T10:00:00Z" },
        { amount_tnd: 149, resolved_at: "2026-10-28T10:00:00Z" },
        { amount_tnd: 500, resolved_at: "2026-08-01T10:00:00Z" },
        { amount_tnd: 50, resolved_at: null },
      ],
      NOW,
    );
    expect(s.month).toBe(128);
    expect(s.paymentsThisMonth).toBe(2);
    expect(s.lastMonth).toBe(249);
    expect(s.lastMonthToDate).toBe(100);
    expect(s.deltaPct).toBe(28);
    expect(s.today).toBe(89);
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1)).toEqual({ date: "2026-11-15", count: 89 });
  });

  it("buckets by Tunis day, not UTC", () => {
    // 23:30 UTC on the 14th is 00:30 on the 15th in Tunis.
    const s = summarizeRevenue([{ amount_tnd: 39, resolved_at: "2026-11-14T23:30:00Z" }], NOW);
    expect(s.today).toBe(39);
  });

  it("has no delta without a last month to compare", () => {
    expect(summarizeRevenue([], NOW).deltaPct).toBeNull();
  });

  it("looks back across a year boundary", () => {
    const s = summarizeRevenue(
      [{ amount_tnd: 39, resolved_at: "2026-12-05T10:00:00Z" }],
      new Date("2027-01-10T11:00:00Z"),
    );
    expect(s.lastMonthToDate).toBe(39);
  });
});

describe("dayPart", () => {
  it("follows the Tunis clock", () => {
    expect(dayPart(new Date("2026-11-15T07:00:00Z"))).toBe("morning");
    expect(dayPart(new Date("2026-11-15T13:00:00Z"))).toBe("afternoon");
    expect(dayPart(new Date("2026-11-15T23:30:00Z"))).toBe("evening");
  });
});
