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
