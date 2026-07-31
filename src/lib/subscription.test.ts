import { describe, expect, it } from "vitest";
import { isSubscriptionActive, nextExpiry } from "./subscription";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

describe("isSubscriptionActive", () => {
  it("lets a paid account with time left through", () => {
    expect(isSubscriptionActive({ payment_status: "active", plan_expires_at: iso(30) })).toBe(true);
  });

  it("blocks the moment the term runs out", () => {
    expect(isSubscriptionActive({ payment_status: "active", plan_expires_at: iso(-1) })).toBe(false);
    // One second past is past.
    const justNow = new Date(Date.now() - 1000).toISOString();
    expect(isSubscriptionActive({ payment_status: "active", plan_expires_at: justNow })).toBe(false);
  });

  it("blocks an account that never paid, however far off its term is", () => {
    expect(isSubscriptionActive({ payment_status: "unpaid", plan_expires_at: iso(365) })).toBe(false);
    expect(isSubscriptionActive({ payment_status: "pending", plan_expires_at: iso(365) })).toBe(false);
  });

  it("lets admins through regardless", () => {
    expect(
      isSubscriptionActive({ payment_status: "unpaid", is_admin: true, plan_expires_at: iso(-99) }),
    ).toBe(true);
  });

  it("blocks a missing profile", () => {
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive({})).toBe(false);
  });

  it("treats a termless active row as open-ended", () => {
    // This is the shape that used to be a free account for life: the payment
    // webhook flipped payment_status and wrote no expiry. Every activation
    // path writes a term now (see nextExpiry) — the fallback stays permissive
    // only so accounts activated before terms existed aren't locked out.
    expect(isSubscriptionActive({ payment_status: "active", plan_expires_at: null })).toBe(true);
  });
});

describe("nextExpiry", () => {
  const now = new Date("2026-07-31T10:00:00.000Z");

  it("starts a first-time subscription from today", () => {
    expect(nextExpiry(null, 1, now).toISOString()).toBe("2026-08-31T10:00:00.000Z");
  });

  it("extends a live subscription from its current end, not from today", () => {
    const current = "2026-09-30T10:00:00.000Z";
    expect(nextExpiry(current, 3, now).toISOString()).toBe("2026-12-30T10:00:00.000Z");
  });

  it("restarts a lapsed subscription from today, so nobody buys back-dated days", () => {
    const lapsed = "2026-06-01T10:00:00.000Z";
    expect(nextExpiry(lapsed, 1, now).toISOString()).toBe("2026-08-31T10:00:00.000Z");
  });

  it("handles a multi-month term across a year boundary", () => {
    expect(nextExpiry(null, 12, new Date("2026-07-31T10:00:00.000Z")).toISOString()).toBe(
      "2027-07-31T10:00:00.000Z",
    );
  });

  it("produces a term that the gate then accepts", () => {
    const expiry = nextExpiry(null, 1).toISOString();
    expect(isSubscriptionActive({ payment_status: "active", plan_expires_at: expiry })).toBe(true);
  });
});
