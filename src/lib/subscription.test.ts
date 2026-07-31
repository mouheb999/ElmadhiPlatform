import { describe, expect, it } from "vitest";
import { isSubscriptionActive, nextExpiry, subscriptionStanding } from "./subscription";

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

describe("subscriptionStanding", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");
  const at = (days: number) =>
    new Date(now.getTime() + days * DAY).toISOString();

  it("flags a term about to run out, while the gate still lets them in", () => {
    const profile = { payment_status: "active", plan_expires_at: at(3) };
    expect(subscriptionStanding(profile, now)).toEqual({ standing: "expiring", daysLeft: 3 });
    // "Expiring" is an admin's to-do, not a lockout.
    expect(isSubscriptionActive(profile)).toBe(true);
  });

  it("keeps a comfortable term plain active", () => {
    expect(subscriptionStanding({ payment_status: "active", plan_expires_at: at(60) }, now))
      .toEqual({ standing: "active", daysLeft: 60 });
  });

  it("counts the days since a lapse, so the recent ones sort first", () => {
    expect(subscriptionStanding({ payment_status: "active", plan_expires_at: at(-12) }, now))
      .toEqual({ standing: "expired", daysLeft: -12 });
  });

  it("separates never-paid from lapsed", () => {
    expect(subscriptionStanding({ payment_status: "unpaid", plan_expires_at: null }, now).standing)
      .toBe("unpaid");
    expect(subscriptionStanding({ payment_status: "pending", plan_expires_at: at(30) }, now).standing)
      .toBe("unpaid");
  });

  it("shows a termless active account as active with no countdown", () => {
    expect(subscriptionStanding({ payment_status: "active", plan_expires_at: null }, now))
      .toEqual({ standing: "active", daysLeft: null });
  });

  it("agrees with the gate on both sides of the boundary", () => {
    for (const days of [-30, -1, 1, 7, 8, 400]) {
      const profile = { payment_status: "active", plan_expires_at: at(days) };
      const { standing } = subscriptionStanding(profile, now);
      expect(standing === "expired", `day ${days}`).toBe(!isSubscriptionActive(profile));
    }
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
