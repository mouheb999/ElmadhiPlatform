import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { utcMonthStart } from "@/lib/dates";

/**
 * How many times a user may regenerate a plan per calendar month — separately
 * for diet and for training.
 *
 * Rebuilding a plan throws away the progression context the coaching loop is
 * built on, and a user who redoes it every other day never trains a block long
 * enough to judge it. Three is enough for "I answered wrong" and "my goal
 * changed" without turning the questionnaire into a slot machine.
 *
 * The database is the real gate — see `enforce_plan_redo_quota()` in migration
 * 033. Everything here exists so the UI can say how many are left and so the
 * user hears about the limit before answering twenty questions, not after.
 */
export const MONTHLY_REDO_LIMIT = 3;

/** Raised by the database trigger; matched to produce a readable message. */
export const REDO_QUOTA_ERROR = "plan_monthly_redo_exceeded";

export type PlanKind = "diet" | "workout";

export type RedoQuota = {
  limit: number;
  used: number;
  remaining: number;
};

const PROFILE_TABLE = {
  diet: "diet_profiles",
  workout: "training_profiles",
} as const;

/**
 * Redos used this calendar month.
 *
 * A redo is any profile after the first: both questionnaires insert a new
 * versioned row and archive the previous one, so `version > 1` is exactly the
 * set of regenerations, and onboarding (version 1) is never charged for.
 */
export async function getRedoQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  kind: PlanKind,
): Promise<RedoQuota> {
  const { count } = await supabase
    .from(PROFILE_TABLE[kind])
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("version", 1)
    .gte("created_at", utcMonthStart().toISOString());

  const used = count ?? 0;
  return { limit: MONTHLY_REDO_LIMIT, used, remaining: Math.max(0, MONTHLY_REDO_LIMIT - used) };
}

/** Both quotas in one round-trip pair — what the settings page shows. */
export async function getRedoQuotas(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Record<PlanKind, RedoQuota>> {
  const [diet, workout] = await Promise.all([
    getRedoQuota(supabase, userId, "diet"),
    getRedoQuota(supabase, userId, "workout"),
  ]);
  return { diet, workout };
}
