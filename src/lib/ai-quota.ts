/**
 * The daily ceiling on AI meal estimates.
 *
 * Enforced in the database by migration 037 (`enforce_ai_estimate_quota`),
 * because the thing being rationed is a metered vision-model call and a Server
 * Function is reachable by direct POST. This module holds the numbers the UI
 * needs to talk about the limit, and the error shape the action translates.
 *
 * MUST stay in sync with v_limit in
 * supabase/migrations/037_ai_estimate_quota.sql.
 *
 * Client-safe, zero deps.
 */

export const DAILY_AI_ESTIMATE_LIMIT = 30;

/** The ERRCODE-tagged prefix migration 037 raises. Matched, never shown. */
export const AI_ESTIMATE_QUOTA_ERROR = "ai_daily_estimate_exceeded";

/** What a user who has hit the ceiling is told. */
export const AI_ESTIMATE_LIMIT_REACHED =
  `You've used all ${DAILY_AI_ESTIMATE_LIMIT} AI estimates for today — ` +
  `log this one by hand, and the counter resets at midnight.`;

/** True when a Postgres error is the daily-estimate cap rather than a fault. */
export function isQuotaError(message: string | undefined | null): boolean {
  return !!message && message.includes(AI_ESTIMATE_QUOTA_ERROR);
}
