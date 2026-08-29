import { describe, expect, it } from "vitest";
import { hoursSince } from "./dates";

/**
 * `hoursSince` drives the "waiting 14h" badge on the payments queue, which is
 * how an admin spots the customer who has been left. A wrong answer here is a
 * customer nobody notices, so the edges are pinned rather than assumed.
 */
describe("hoursSince", () => {
  const now = Date.parse("2026-08-29T12:00:00Z");

  it("counts whole hours", () => {
    expect(hoursSince("2026-08-29T09:00:00Z", now)).toBe(3);
    expect(hoursSince("2026-08-27T12:00:00Z", now)).toBe(48);
  });

  it("floors a partial hour rather than rounding it up", () => {
    // 59 minutes is not "waiting 1h" — the badge would claim the promise had
    // been broken before it had been.
    expect(hoursSince("2026-08-29T11:01:00Z", now)).toBe(0);
    expect(hoursSince("2026-08-29T10:59:00Z", now)).toBe(1);
  });

  it("never goes negative on a clock skew", () => {
    expect(hoursSince("2026-08-29T13:00:00Z", now)).toBe(0);
  });

  it("returns null for nothing to measure", () => {
    expect(hoursSince(null, now)).toBeNull();
    expect(hoursSince(undefined, now)).toBeNull();
    expect(hoursSince("not a date", now)).toBeNull();
  });
});
