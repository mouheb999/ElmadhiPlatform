/**
 * What a signed-in account can reach before it has paid.
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
 * Paid surface, matched as path prefixes.
 *
 * Note these are the *leaf* routes, not the section roots. `/workout` and
 * `/diet` stay open so a free account can browse its own plan; it is
 * `/workout/session/…` and `/diet/log` — the acts of recording something — that
 * are held back. `/dashboard` is open for the same reason, and the controls on
 * it that write data guard themselves.
 */
export const PAID_PREFIXES = [
  "/ai",
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
