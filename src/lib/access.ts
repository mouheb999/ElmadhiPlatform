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
 * The marker appended to the WebView's user agent by the Capacitor shell
 * (`appendUserAgent` in capacitor.config.ts). Its presence is the only thing
 * that distinguishes a request from inside the Android app from the same
 * request made in a browser.
 *
 * Treat it as a routing hint, never as a security boundary: a user agent is
 * set by the caller, so anybody can send this string. Nothing here decides who
 * may *read* data — that is the subscription gate and RLS, both of which run
 * identically either way. All this changes is which screens the app offers,
 * and the worst a forged header can do is show a browser the app's navigation.
 *
 * Note this constant cannot be referenced from `config.matcher` in proxy.ts:
 * matcher values must be statically analysable at build time, so a variable
 * there is silently ignored. The pattern is spelled out literally in that file,
 * next to a comment pointing back here.
 */
export const APP_SHELL_UA = "HypeFitnessApp";

/** True when a request came from the Capacitor shell rather than a browser. */
export function isAppShellUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(APP_SHELL_UA);
}

/**
 * Routes the Android app must never show, matched as path prefixes (plus "/",
 * handled exactly — as a prefix it would match the entire site).
 *
 * Two different reasons, both pointing the same way. Google Play requires that
 * an app not sell a digital subscription through an outside payment flow, and
 * /checkout is exactly that: plan prices in dinars, a bank account number and a
 * receipt upload. And the marketing surface — the hero, the eleven-question
 * funnel pitched at ad traffic — is a sales page for a product the person has
 * already installed, which makes the app feel like a website with a toolbar
 * hidden.
 *
 * /phone is here because it is a step *inside* checkout; reachable on its own
 * it is a form asking an app user for a contact number with nothing behind it.
 *
 * None of this changes the web. A browser reaches all four exactly as before.
 */
export const BLOCKED_IN_APP_PREFIXES = ["/start", "/checkout", "/phone"] as const;

/** True when `pathname` is part of the web-only marketing and payment surface. */
export function isBlockedInApp(pathname: string): boolean {
  if (pathname === "/") return true;
  return BLOCKED_IN_APP_PREFIXES.some((p) => matches(pathname, p));
}

/**
 * Readable in the app while unpaid, even though the web charges for it.
 *
 * The Q&A library is the one paid surface that is worth more as a preview than
 * as a locked door. It is a hundred and fifty written answers; somebody who can
 * read them knows what the coach sounds like, which is the thing a subscription
 * is actually bought on. Nothing here is per-user, so there is no data to leak.
 *
 * *Asking* a question is untouched and still paid — `submitQaRequest` guards
 * itself with `requirePaidUser`, so the composer is replaced by a members-only
 * card rather than left to fail on submit.
 *
 * Web behaviour is unchanged: /qa stays in PAID_PREFIXES and an unpaid browser
 * never reaches it.
 */
export const APP_PREVIEW_PREFIXES = ["/qa"] as const;

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

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * True when reaching `pathname` requires an active subscription.
 *
 * `appShell` makes the Android app behave as though the reverse trial were on,
 * whatever the web is doing. It has to, and the reason is structural rather
 * than a preference: on the web an account with nothing to show is sent to
 * /checkout, and /checkout is the one screen the app is not allowed to have.
 * Without a free surface of its own the app would have no destination for a
 * new install at all — every route gated, and the only exit removed. So an
 * unpaid app user gets what the trial grants (their answers, their numbers,
 * their program and meal plan, readable) and meets a "this is for members"
 * card at the things that record or track.
 *
 * Deliberately the same PAID_PREFIXES list rather than a second one. Two lists
 * would drift, and then the app and the web would disagree about what a
 * subscription buys.
 */
export function isPaidPath(
  pathname: string,
  options?: { appShell?: boolean },
): boolean {
  // Checked first in every mode: an always-free route must never be gated, or
  // the redirect to /checkout has nowhere to land.
  if (ALWAYS_FREE_PREFIXES.some((p) => matches(pathname, p))) return false;
  // Free to read in the app although the web charges for it. Checked before
  // PAID_PREFIXES rather than removed from it, so the web keeps gating /qa.
  if (
    options?.appShell &&
    APP_PREVIEW_PREFIXES.some((p) => matches(pathname, p))
  ) {
    return false;
  }
  // Trial off on the web: everything that is left costs money, including the
  // questionnaires and the plan they produce. The app never takes this branch.
  if (!REVERSE_TRIAL && !options?.appShell) return true;
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
