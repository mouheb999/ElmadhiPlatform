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
  plan_type?: string | null;
  /** Migration 058. Full access without a confirmed payment until then. */
  free_access_until?: string | null;
};

/**
 * How long a new account gets the whole product before it is asked to pay.
 *
 * MUST stay in sync with the interval in `handle_new_user`
 * (supabase/migrations/058_free_access_window.sql) — the database grants the
 * days, this constant is only what the copy says.
 */
export const TRIAL_DAYS = 3;

/**
 * How long a customer who has attached a receipt is let in while a person
 * checks the transfer. Long enough to cover a weekend night; short enough that
 * a screenshot of nothing buys very little.
 */
export const RECEIPT_GRACE_HOURS = 48;

/** True while an unpaid grant — the trial, or a receipt under review — runs. */
export function hasFreeAccess(
  profile: SubscriptionProfile | null,
  now: Date = new Date(),
): boolean {
  if (!profile?.free_access_until) return false;
  return new Date(profile.free_access_until) > now;
}

/** True when a confirmed payment, and nothing else, is what lets them in. */
export function hasPaidTerm(
  profile: SubscriptionProfile | null,
  now: Date = new Date(),
): boolean {
  if (!profile || profile.payment_status !== "active") return false;
  if (!profile.plan_expires_at) return true;
  return new Date(profile.plan_expires_at) > now;
}

/**
 * Whole days left on the free window, rounded up — "2 days left" until the
 * last day, then "1". Null when there is no window or it has closed.
 */
export function freeAccessDaysLeft(
  profile: SubscriptionProfile | null,
  now: Date = new Date(),
): number | null {
  if (!hasFreeAccess(profile, now)) return null;
  const ms = new Date(profile!.free_access_until!).getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/**
 * When a free window should end after being pushed out by `hours`.
 *
 * Never shortens: somebody on day one of a trial who attaches a receipt keeps
 * the two days they already had rather than trading them for 48 hours.
 */
export function extendFreeAccess(
  currentUntil: string | null | undefined,
  hours: number,
  now: Date = new Date(),
): Date {
  const pushed = new Date(now.getTime() + hours * 3_600_000);
  const current = currentUntil ? new Date(currentUntil) : null;
  return current && current > pushed ? current : pushed;
}

/**
 * Where a free window falls back to when a receipt is turned down.
 *
 * The 48 hours were granted on the strength of that receipt, so they go — but
 * the sign-up trial was not, and whatever is left of it stays. An account past
 * its trial is closed as of now.
 */
export function revokeReceiptGrace(
  accountCreatedAt: string | null | undefined,
  now: Date = new Date(),
): Date {
  if (!accountCreatedAt) return now;
  const trialEnd = new Date(new Date(accountCreatedAt).getTime() + TRIAL_DAYS * 86_400_000);
  return trialEnd > now ? trialEnd : now;
}

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
  // The trial and the receipt window open the same door a payment does. Kept
  // in step with `current_user_is_subscribed()` (migration 058): if the app
  // let these through and RLS did not, every write they made would be refused.
  if (hasFreeAccess(profile)) return true;
  return hasPaidTerm(profile);
}

/**
 * The Premium tier specifically, not just "paid".
 *
 * The AI estimator costs real money per call, so it is sold as Premium only —
 * but that was enforced on the page and nowhere else, and a page is not a
 * boundary. Server Functions are reachable by a direct POST, so a Standard
 * subscriber could call the estimator and bill Gemini to the house. Same shape
 * of mistake as gating a route without gating the action behind it.
 */
export function isPremiumActive(profile: SubscriptionProfile | null): boolean {
  if (!isSubscriptionActive(profile)) return false;
  // A trial is a trial of the whole product. The meal scan is the feature the
  // ads lead with, and a trial that hid it would be a trial of something else.
  // What it costs is bounded separately — see TRIAL_DAILY_AI_ESTIMATE_LIMIT.
  return (
    profile?.is_admin === true ||
    profile?.plan_type === "premium" ||
    (hasFreeAccess(profile) && !hasPaidTerm(profile))
  );
}

/** What a guarded action returns to a lapsed user. */
export const SUBSCRIPTION_REQUIRED = "Your subscription has ended — renew to keep going.";

/** What a guarded action returns to a paid user on the wrong tier. */
export const PREMIUM_REQUIRED = "The AI estimator is part of the Premium plan.";

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
