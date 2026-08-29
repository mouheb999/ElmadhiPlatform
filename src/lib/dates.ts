/**
 * App-time helpers — everything that means "today" or "this week" for a user
 * is computed in Africa/Tunis (UTC+1, no DST), never in server-local time
 * (prod servers run UTC) and never in device time.
 *
 * MUST stay in sync with the weekly-lock index in
 * supabase/migrations/018_live_sessions_progress.sql:
 *   date_trunc('week', timezone('Africa/Tunis', completed_at))
 * i.e. ISO weeks starting Monday 00:00 Tunis.
 *
 * Client-safe, zero deps.
 */

const TUNIS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no DST

/** The current moment shifted so that UTC getters read Tunis wall-clock. */
function tunisWall(now: Date): Date {
  return new Date(now.getTime() + TUNIS_OFFSET_MS);
}

/** Start of the Tunis calendar day (00:00 Tunis) as a real UTC Date. */
export function tunisDayStartUtc(now: Date = new Date()): Date {
  const wall = tunisWall(now);
  return new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - TUNIS_OFFSET_MS,
  );
}

/** Start of the current ISO week (Monday 00:00 Tunis) as a real UTC Date. */
export function tunisWeekStartUtc(now: Date = new Date()): Date {
  const dayStart = tunisDayStartUtc(now);
  const wall = tunisWall(dayStart); // midnight Tunis, read weekday via UTC getters
  const sinceMonday = (wall.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(dayStart.getTime() - sinceMonday * 24 * 60 * 60 * 1000);
}

/**
 * Start of the current calendar month in UTC.
 *
 * The odd one out on purpose: monthly quotas (Q&A asks, plan redos) are
 * enforced by database triggers using `date_trunc('month', NOW())`, which is
 * UTC on the server. The client-side count has to bucket the same rows the
 * trigger would, so it uses UTC here rather than Tunis — one hour of drift on
 * the first of the month, against a limit measured in whole months.
 */
export function utcMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** YYYY-MM-DD of the Tunis calendar day (e.g. daily_checkins.checkin_date). */
export function tunisDateKey(now: Date = new Date()): string {
  return tunisWall(now).toISOString().slice(0, 10);
}

/** YYYY-MM-DD Tunis key for N days ago (0 = today). */
export function tunisDaysAgoKey(days: number): string {
  return tunisDateKey(new Date(Date.now() - days * 86400000));
}

/** Previous Tunis calendar day as YYYY-MM-DD (streak walking). */
export function prevDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bucket a timestamptz ISO string into its Tunis week, keyed by the Monday's
 * YYYY-MM-DD. Used to aggregate sessions/sets into weekly chart points.
 */
export function tunisWeekKey(iso: string): string {
  return tunisDateKey(tunisWeekStartUtc(new Date(iso)));
}

/**
 * Whole hours since an ISO timestamp, or null if there isn't one.
 *
 * Lives here rather than inline at the call site for two reasons: the admin
 * queue and anything else that wants to say "waiting 14h" should agree on what
 * that means, and reading the clock inline in a render body is a purity
 * violation the lint rules (rightly) refuse. A named helper is the honest
 * version of the same snapshot — and it is testable, which an inline
 * `Date.now()` is not.
 */
export function hoursSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now - then) / 3_600_000));
}
