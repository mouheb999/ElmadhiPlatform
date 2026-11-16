import { describe, expect, it } from "vitest";
import { BACKFILL_DAYS, canLogOn, resolveLogDate } from "./log-date";

// Noon in Tunis on 16 Nov 2026.
const NOW = new Date("2026-11-16T11:00:00Z");

describe("canLogOn", () => {
  it("allows today and days inside the window", () => {
    expect(canLogOn("2026-11-16", NOW)).toBe(true);
    expect(canLogOn("2026-11-15", NOW)).toBe(true);
    expect(canLogOn("2026-10-17", NOW)).toBe(true);
    expect(BACKFILL_DAYS).toBe(30);
  });

  it("refuses the future and anything older than the window", () => {
    expect(canLogOn("2026-11-17", NOW)).toBe(false);
    expect(canLogOn("2026-10-16", NOW)).toBe(false);
  });

  it("uses the Tunis day, not UTC", () => {
    // 23:30 UTC on the 16th is already the 17th in Tunis.
    expect(canLogOn("2026-11-17", new Date("2026-11-16T23:30:00Z"))).toBe(true);
  });

  it("refuses anything that is not a real day", () => {
    for (const bad of ["", "yesterday", "2026-2-3", "2026-02-31", "2026-11-16T00:00", "2026-11-16; drop"]) {
      expect(canLogOn(bad, NOW)).toBe(false);
    }
  });
});

describe("resolveLogDate", () => {
  it("defaults to today when no day is asked for", () => {
    expect(resolveLogDate(undefined, NOW)).toBe("2026-11-16");
    expect(resolveLogDate(null, NOW)).toBe("2026-11-16");
  });

  it("passes an allowed day through and refuses the rest", () => {
    expect(resolveLogDate("2026-11-10", NOW)).toBe("2026-11-10");
    expect(resolveLogDate("2026-11-20", NOW)).toBeNull();
    expect(resolveLogDate("2025-01-01", NOW)).toBeNull();
  });
});
