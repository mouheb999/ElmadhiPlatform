import { describe, expect, it } from "vitest";
import {
  RECEIPT_GRACE_HOURS,
  TRIAL_DAYS,
  extendFreeAccess,
  freeAccessDaysLeft,
  hasFreeAccess,
  hasPaidTerm,
  isPremiumActive,
  isSubscriptionActive,
  nextExpiry,
  revokeReceiptGrace,
  subscriptionStanding,
} from "./subscription";

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
  // Anchored to real time rather than a fixed date. Two of these compare
  // subscriptionStanding(), which takes an injected `now`, against
  // isSubscriptionActive(), which reads the system clock and has no such
  // parameter — so a hardcoded anchor only kept them agreeing while that date
  // was still in the future. It was 2026-07-31, and the suite went red on its
  // own once real time passed it. Offsets stay exact, so nothing gets flaky.
  const now = new Date();
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

describe("the free-access window (migration 058)", () => {
  it("lets an unpaid account through while the window is open", () => {
    expect(isSubscriptionActive({ payment_status: "unpaid", free_access_until: iso(2) })).toBe(true);
    expect(isSubscriptionActive({ payment_status: "pending", free_access_until: iso(1) })).toBe(true);
  });

  it("closes the moment the window does", () => {
    const justNow = new Date(Date.now() - 1000).toISOString();
    expect(isSubscriptionActive({ payment_status: "unpaid", free_access_until: justNow })).toBe(false);
    expect(isSubscriptionActive({ payment_status: "unpaid", free_access_until: null })).toBe(false);
  });

  it("does not shorten a paid term that outlasts it", () => {
    expect(
      isSubscriptionActive({
        payment_status: "active",
        plan_expires_at: iso(30),
        free_access_until: iso(-5),
      }),
    ).toBe(true);
  });

  it("includes the meal scan in a trial, but not for a lapsed Standard plan", () => {
    expect(isPremiumActive({ payment_status: "unpaid", free_access_until: iso(2) })).toBe(true);
    expect(isPremiumActive({ payment_status: "unpaid", free_access_until: iso(-1) })).toBe(false);
    // A paying Standard subscriber is on the tier they bought, window or not.
    expect(
      isPremiumActive({
        payment_status: "active",
        plan_type: "standard",
        plan_expires_at: iso(30),
        free_access_until: iso(2),
      }),
    ).toBe(false);
  });

  it("tells a paid term apart from a window", () => {
    expect(hasPaidTerm({ payment_status: "unpaid", free_access_until: iso(2) })).toBe(false);
    expect(hasPaidTerm({ payment_status: "active", plan_expires_at: iso(2) })).toBe(true);
    expect(hasFreeAccess({ free_access_until: iso(2) })).toBe(true);
    expect(hasFreeAccess(null)).toBe(false);
  });

  it("counts days left, rounding up and never showing zero", () => {
    expect(freeAccessDaysLeft({ free_access_until: iso(3) })).toBe(3);
    expect(freeAccessDaysLeft({ free_access_until: iso(1.2) })).toBe(2);
    expect(freeAccessDaysLeft({ free_access_until: iso(0.01) })).toBe(1);
    expect(freeAccessDaysLeft({ free_access_until: iso(-1) })).toBeNull();
    expect(freeAccessDaysLeft({})).toBeNull();
  });

  it("pushes the window out for a receipt without ever shortening it", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    // No window, or a closed one: 48 hours from now.
    expect(extendFreeAccess(null, RECEIPT_GRACE_HOURS, now).toISOString()).toBe(
      "2026-11-13T10:00:00.000Z",
    );
    expect(extendFreeAccess("2026-11-01T00:00:00Z", RECEIPT_GRACE_HOURS, now).toISOString()).toBe(
      "2026-11-13T10:00:00.000Z",
    );
    // Day one of a trial with nearly three days left keeps them.
    expect(extendFreeAccess("2026-11-14T09:00:00Z", RECEIPT_GRACE_HOURS, now).toISOString()).toBe(
      "2026-11-14T09:00:00.000Z",
    );
  });

  it("falls back to the trial, not to nothing, when a receipt is turned down", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    // Signed up yesterday: the trial still has two days, and they stay.
    expect(revokeReceiptGrace("2026-11-10T10:00:00Z", now).toISOString()).toBe(
      "2026-11-13T10:00:00.000Z",
    );
    // Signed up last month: the trial is long over, so access ends now.
    expect(revokeReceiptGrace("2026-10-01T10:00:00Z", now).toISOString()).toBe(now.toISOString());
    expect(revokeReceiptGrace(null, now).toISOString()).toBe(now.toISOString());
    expect(TRIAL_DAYS).toBe(3);
  });
});
