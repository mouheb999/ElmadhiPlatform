import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Fallback used when `qa_settings` can't be read (migration 031 not applied
 * yet, or the row is missing). The database is the source of truth — see
 * `enforce_qa_request_quota()` — this only keeps the UI sane.
 */
export const QA_DEFAULT_MONTHLY_LIMIT = 3;

export type QaQuota = {
  limit: number;
  used: number;
  remaining: number;
};

/** Start of the current calendar month, matching the trigger's date_trunc. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The configured number of questions a user may ask per calendar month. */
export async function getQaMonthlyLimit(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data } = await supabase
    .from("qa_settings")
    .select("monthly_question_limit")
    .eq("id", 1)
    .maybeSingle();
  return data?.monthly_question_limit ?? QA_DEFAULT_MONTHLY_LIMIT;
}

/**
 * How much of this month's allowance a user has spent. Counts every request
 * they submitted, dismissed ones included: the quota is on asking, not on
 * being answered — otherwise a rejected question could be resubmitted forever.
 */
export async function getQaQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<QaQuota> {
  const [limit, { count }] = await Promise.all([
    getQaMonthlyLimit(supabase),
    supabase
      .from("qa_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart().toISOString()),
  ]);

  const used = count ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}
