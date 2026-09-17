"use client";

/**
 * Where the funnel keeps things in the browser.
 *
 * All of it is cookies rather than `localStorage`, for one reason: the server
 * has to be able to read it. The sign-up action attaches the answers and the
 * ad attribution to the new account, and `/diet/questions` pre-fills itself
 * from the same answers — neither can see `localStorage`. Cookies go up with
 * every request for free.
 *
 * None of it is httpOnly and none of it needs to be. These are the visitor's
 * own answers about their own body and the campaign parameters their own
 * browser was handed; there is nothing here that would matter if they edited
 * it, because nothing here is trusted. Every number the paid plan is built
 * from is recomputed server-side from the questionnaire they submit.
 */

import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  attributionFromParams,
  parseAttribution,
  shouldReplace,
  type Attribution,
} from "./attribution";
import {
  FUNNEL_COOKIE,
  FUNNEL_COOKIE_MAX_AGE,
  parseFunnelAnswers,
  serializeFunnelAnswers,
  type FunnelAnswers,
} from "./answers";

/** One pass through the funnel, for counting drop-off. Not stable across visits. */
const VISIT_KEY = "elmadhi_visit";

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function writeCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * The id this visit is counted under.
 *
 * `sessionStorage`, not a cookie: it should die with the tab, because it is
 * only ever used to join "reached question 4" to "reached the paywall" within
 * one sitting. A visitor who comes back tomorrow is a new row in the funnel,
 * which is the honest way to count them.
 */
export function visitId(): string {
  if (typeof window === "undefined") return "";
  try {
    const held = sessionStorage.getItem(VISIT_KEY);
    if (held) return held;
    const minted = crypto.randomUUID();
    sessionStorage.setItem(VISIT_KEY, minted);
    return minted;
  } catch {
    // Private mode, or storage blocked. The funnel still works; this visit is
    // simply not counted, which is the correct trade.
    return "";
  }
}

/**
 * Read the ad parameters off the current URL and keep them.
 *
 * Call it on every public entry point — the landing page and /start — because
 * an ad can point at either. An ordinary visit carries nothing and leaves what
 * is already stored alone, so walking from the landing page into the funnel
 * does not relabel a Meta click as organic.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const incoming = attributionFromParams(
    new URLSearchParams(window.location.search),
    document.referrer || null,
  );
  if (shouldReplace(incoming)) {
    writeCookie(ATTRIBUTION_COOKIE, JSON.stringify(incoming), ATTRIBUTION_MAX_AGE);
    return incoming;
  }
  return parseAttribution(readCookie(ATTRIBUTION_COOKIE));
}

/** The stored attribution as the raw cookie string, for handing to the server. */
export function rawAttribution(): string | null {
  return readCookie(ATTRIBUTION_COOKIE);
}

export function loadAnswers(): Partial<FunnelAnswers> {
  return parseFunnelAnswers(readCookie(FUNNEL_COOKIE));
}

/**
 * Save after every answer, not once at the end.
 *
 * Somebody who answers six questions, closes the tab and comes back tomorrow
 * should resume at question seven. Writing only on completion would throw away
 * exactly the visitors who are hardest to get back.
 */
export function saveAnswers(answers: Partial<FunnelAnswers>): void {
  writeCookie(FUNNEL_COOKIE, serializeFunnelAnswers(answers), FUNNEL_COOKIE_MAX_AGE);
}

export function clearAnswers(): void {
  deleteCookie(FUNNEL_COOKIE);
}
