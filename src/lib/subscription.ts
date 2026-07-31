/**
 * Who may use the paid product — the predicate alone.
 *
 * This module is dependency-free on purpose: `proxy.ts` runs in its own bundle
 * and must not drag `next/headers` in, and the paid Server Functions need the
 * same answer. Both import from here so the optimistic gate in front of the
 * routes and the real boundary next to the data can never disagree.
 *
 * The request-scoped helpers live in `subscription-server.ts`.
 */

export type SubscriptionProfile = {
  payment_status?: string | null;
  is_admin?: boolean | null;
  plan_expires_at?: string | null;
};

/**
 * A null `plan_expires_at` counts as *no expiry*. That is only ever true for
 * accounts activated before subscriptions had terms — every path that flips
 * `payment_status` to active now writes one (see `activateRequest` and the
 * payment webhook), because an active row with no term is a free account for
 * life.
 */
export function isSubscriptionActive(profile: SubscriptionProfile | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.payment_status !== "active") return false;
  if (!profile.plan_expires_at) return true;
  return new Date(profile.plan_expires_at) > new Date();
}

/** What a guarded action returns to a lapsed user. */
export const SUBSCRIPTION_REQUIRED = "Your subscription has ended — renew to keep going.";

/** How far ahead the admin list warns that a term is about to run out. */
export const EXPIRING_SOON_DAYS = 7;

/**
 * Where an account stands, for the admin subscriptions list.
 *
 * `expiring` is not a state the app enforces — it is still `active` to the
 * gate. It exists so somebody can be reminded to renew *before* they get
 * locked out rather than after.
 */
export type SubscriptionStanding = "active" | "expiring" | "expired" | "unpaid";

export type SubscriptionStandingResult = {
  standing: SubscriptionStanding;
  /** Whole days until the term ends; negative once it has. Null = no term. */
  daysLeft: number | null;
};

const DAY_MS = 86_400_000;

export function subscriptionStanding(
  profile: SubscriptionProfile | null,
  now: Date = new Date(),
): SubscriptionStandingResult {
  if (!profile || profile.payment_status !== "active") {
    return { standing: "unpaid", daysLeft: null };
  }
  if (!profile.plan_expires_at) return { standing: "active", daysLeft: null };

  const daysLeft = Math.ceil(
    (new Date(profile.plan_expires_at).getTime() - now.getTime()) / DAY_MS,
  );
  if (daysLeft <= 0) return { standing: "expired", daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { standing: "expiring", daysLeft };
  return { standing: "active", daysLeft };
}

/**
 * When a subscription should run out after paying for `months`.
 *
 * A renewal extends the term the customer already has; a lapsed or first-time
 * plan starts from now, so nobody pays for days that already went by. Every
 * path that activates an account goes through this — an activation that writes
 * `payment_status = 'active'` and no term is a free account for life.
 */
export function nextExpiry(
  currentExpiresAt: string | null | undefined,
  months: number,
  now: Date = new Date(),
): Date {
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && current > now ? current : now;
  const expiry = new Date(base);
  // Calendar months, so a term always lands on the same day of the month it
  // was bought (JS rolls a short month forward — buying on Jan 31 expires
  // Mar 3, which errs in the customer's favour).
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}
