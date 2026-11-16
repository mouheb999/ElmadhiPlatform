/**
 * Which day a food log may be written to.
 *
 * Logging used to be today-only. People forget — dinner gets entered the next
 * morning, a weekend gets filled in on Monday — and a diary that refuses
 * yesterday teaches them to stop keeping it. So a past day is allowed, within
 * a window: far enough back to catch up after a week away, not so far that
 * history the weekly review already judged can be rewritten at will.
 *
 * Never the future: a meal that has not been eaten is a plan, not a log.
 *
 * Dependency-free apart from the date helper, so the server actions (the real
 * gate) and the diary UI (which only decides whether to show the button) use
 * the same rule.
 */

import { tunisDateKey } from "@/lib/dates";

/** How many days back from today a meal can still be logged. */
export const BACKFILL_DAYS = 30;

const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** True when `dateKey` (a Tunis YYYY-MM-DD) is today or inside the window. */
export function canLogOn(dateKey: string, now: Date = new Date()): boolean {
  if (!DATE_KEY.test(dateKey)) return false;
  // Reject shapes that match the pattern but are not days (2026-02-31).
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey) return false;
  const today = tunisDateKey(now);
  const oldest = tunisDateKey(new Date(now.getTime() - BACKFILL_DAYS * DAY_MS));
  return dateKey <= today && dateKey >= oldest;
}

/**
 * The day a log row should be stamped with: the requested day when it is
 * allowed, today when none was asked for, null when the request is refused.
 */
export function resolveLogDate(
  requested: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (requested === null || requested === undefined || requested === "") return tunisDateKey(now);
  return canLogOn(requested, now) ? requested : null;
}
