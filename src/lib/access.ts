/**
 * What a signed-in account can reach before it has paid.
 *
 * **Right now: nothing.** `REVERSE_TRIAL` is off, so this file is back to the
 * old shape described below — pay first, then use the product. The reasoning
 * that follows is kept intact rather than deleted, because it is the case for
 * turning the trial back on and it should not have to be reconstructed from
 * memory when that happens.
 *
 * The old shape put every route behind the paywall, questionnaires included, so
 * a new signup met "give us your number" and then "pay 49 DT" without ever
 * seeing a screen of the product. Nine hundred accounts arrived at that page and
 * almost none of them paid, which is the expected outcome of asking for money
 * before showing anything.
 *
 * So the boundary moved rather than softened. Building a plan and reading it
 * back is free and stays free: the questionnaires, the generated split, the
 * macros, the meal templates. What costs money is *using* the plan day to day —
 * recording sessions, logging meals, watching the charts move, asking the coach.
 * By the time somebody hits that wall they are looking at their own program with
 * their own numbers in it, which is a different question from the one the old
 * checkout page asked.
 *
 * Dependency-free on purpose, same as `subscription.ts`: `proxy.ts` runs in its
 * own bundle and the client components that grey out a locked control need the
 * same answer. One list, so the gate and the UI cannot disagree about what is
 * locked.
 */

/**
 * The reverse trial — currently OFF.
 *
 * Off, every account pays before it sees anything: a new signup lands on
 * /checkout and stays there until an admin activates it. On, the surface
 * described above applies — building a plan is free, using it is not.
 *
 * This is a code constant rather than an env var on purpose. `proxy.ts` runs in
 * its own bundle and the locked-control UI runs in the browser, so the only env
 * var that could reach all three is a `NEXT_PUBLIC_` one — and those are inlined
 * at `next build` and frozen, which is exactly the trap that broke sign-in (see
 * lib/site-url.ts). A constant is honest about needing a deploy either way.
 *
 * To put the trial back: flip this to `true`. Nothing else changes — the paid
 * surface below is unchanged, and `requirePlanUser` in subscription-server.ts
 * reads this same flag so the route gate and the plan-building actions can
 * never disagree about which mode the product is in.
 */
export const REVERSE_TRIAL = false;

/**
 * Reachable while locked out, in either mode — the routes a user who cannot get
 * in still needs.
 *
 * /checkout is where they pay and /phone is the step in front of it, so gating
 * either is a redirect loop. /support is how "I paid and I'm still locked out"
 * reaches an admin. /admin has its own `requireAdmin`, and admins pass the
 * subscription gate anyway. /settings is here for one specific reason: it holds
 * the only sign-out button in the product, so paywalling it would leave a
 * locked-out account with no way to leave its own session.
 */
export const ALWAYS_FREE_PREFIXES = [
  "/checkout",
  "/phone",
  "/support",
  "/settings",
  "/admin",
] as const;

/**
 * Paid surface while the reverse trial is ON, matched as path prefixes. With it
 * off this list is not consulted: everything outside ALWAYS_FREE_PREFIXES costs
 * money.
 *
 * Note these are the *leaf* routes, not the section roots. `/workout` and
 * `/diet` stay open so a free account can browse its own plan; it is
 * `/workout/session/…` and `/diet/log` — the acts of recording something — that
 * are held back. `/dashboard` is open for the same reason, and the controls on
 * it that write data guard themselves.
 */
export const PAID_PREFIXES = [
  // Deliberately absent: /ai. The page opens for everyone and explains what the
  // estimator does, because a feature nobody has seen cannot sell itself — the
  // same reason the program and the meal plan are readable unpaid. Its page
  // renders a walkthrough instead of the camera for anyone not on Premium, and
  // the estimator actions enforce the tier themselves (requirePremiumUser), so
  // nothing here is load-bearing for access.
  "/qa",
  "/review",
  "/progress",
  "/diet/log",
  "/workout/session",
] as const;

/**
 * Free surface worth naming explicitly, because it is the part that has to keep
 * working for an unpaid account or the whole idea collapses.
 */
export const FREE_PREFIXES = [
  "/dashboard",
  "/workout",
  "/workout/questions",
  "/workout/program",
  "/workout/rationale",
  "/diet",
  "/diet/questions",
  "/diet/plan",
  "/diet/rationale",
  "/settings",
  "/checkout",
  "/support",
] as const;

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True when reaching `pathname` requires an active subscription. */
export function isPaidPath(pathname: string): boolean {
  // Checked first in both modes: an always-free route must never be gated, or
  // the redirect to /checkout has nowhere to land.
  if (ALWAYS_FREE_PREFIXES.some((p) => matches(pathname, p))) return false;
  // Trial off: everything that is left costs money, including the
  // questionnaires and the plan they produce.
  if (!REVERSE_TRIAL) return true;
  return PAID_PREFIXES.some((p) => matches(pathname, p));
}

/**
 * The features a locked account can see but not use. Drives the upgrade prompt
 * copy, so the wall names the thing the user just reached for rather than
 * showing one generic "upgrade" everywhere.
 */
export type LockedFeature =
  | "session"
  | "meal_log"
  | "checkin"
  | "progress"
  | "ai"
  | "qa";

/**
 * Which locked feature a paid path belongs to, so the proxy's redirect to
 * checkout carries the same `?from=` vocabulary the in-app upgrade cards use.
 * Two spellings of the same idea would leave checkout unable to name half the
 * ways a user arrives at it.
 */
export function featureForPath(pathname: string): LockedFeature | null {
  if (matches(pathname, "/workout/session")) return "session";
  if (matches(pathname, "/diet/log")) return "meal_log";
  if (matches(pathname, "/progress")) return "progress";
  if (matches(pathname, "/review")) return "progress";
  if (matches(pathname, "/ai")) return "ai";
  if (matches(pathname, "/qa")) return "qa";
  return null;
}
