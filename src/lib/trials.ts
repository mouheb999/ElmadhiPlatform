/**
 * Free-trial numbers for the admin panel — the predicate and the counting,
 * with no database access, so it can be tested on plain rows.
 *
 * A trial is not a column of its own. Migration 058 gives every new account
 * `free_access_until = signup + 3 days`, so "a trial was started" is "a
 * non-admin account exists with a free window set". Two things muddy that and
 * are separated out here:
 *
 *   - A repeat sign-up from a device that already had a trial has its window
 *     closed the moment it is created (`closeRepeatTrial`, lib/trial-device),
 *     which leaves `free_access_until` within seconds of `created_at`. That
 *     person never got a trial, so they are counted as `blocked`, not started.
 *   - A receipt can push the window out by 48 hours. That does not make it a
 *     second trial — each account is counted once, on the day it signed up.
 */

import { tunisDateKey } from "@/lib/dates";

export type TrialProfile = {
  id: string;
  created_at: string | null;
  free_access_until: string | null;
  payment_status: string | null;
  paid_at?: string | null;
};

/**
 * Where a trial account stands now.
 *
 *   paid    — turned into a paying customer
 *   paying  — sent a payment request that is waiting on an admin
 *   active  — still inside the free days
 *   ended   — free days over, never paid
 *   blocked — repeat sign-up on a device that already had a trial
 */
export type TrialStatus = "paid" | "paying" | "active" | "ended" | "blocked";

/** A window shorter than this was closed at sign-up, not used up. */
const BLOCKED_WINDOW_MS = 60 * 60 * 1000;

const DAY_MS = 86_400_000;

export function trialStatus(profile: TrialProfile, now: Date = new Date()): TrialStatus {
  if (profile.payment_status === "active" || profile.paid_at) return "paid";
  if (profile.payment_status === "pending") return "paying";
  const until = profile.free_access_until ? Date.parse(profile.free_access_until) : NaN;
  const created = profile.created_at ? Date.parse(profile.created_at) : NaN;
  if (Number.isFinite(until) && Number.isFinite(created) && until - created < BLOCKED_WINDOW_MS) {
    return "blocked";
  }
  return Number.isFinite(until) && until > now.getTime() ? "active" : "ended";
}

/** Whole days left on an open window, rounded up; null once it has closed. */
export function trialDaysLeft(profile: TrialProfile, now: Date = new Date()): number | null {
  if (!profile.free_access_until) return null;
  const ms = Date.parse(profile.free_access_until) - now.getTime();
  return ms > 0 ? Math.max(1, Math.ceil(ms / DAY_MS)) : null;
}

export type TrialDay = { date: string; count: number };

export type TrialSummary = {
  /** Trials actually granted — repeat sign-ups excluded. */
  started: { today: number; week: number; month: number; total: number };
  byStatus: Record<TrialStatus, number>;
  /** Paid ÷ started, 0–100, rounded. Null before the first trial. */
  conversionPct: number | null;
  /** One entry per Tunis day, oldest first, ending today. */
  daily: TrialDay[];
};

/**
 * Count trials by the Tunis day they started on.
 *
 * The daily series starts at the first trial when that is more recent than
 * `days` ago: zeros before the feature existed would read as "nobody signed
 * up", which is not what happened.
 */
export function summarizeTrials(
  profiles: TrialProfile[],
  now: Date = new Date(),
  days = 30,
): TrialSummary {
  const byStatus: Record<TrialStatus, number> = {
    paid: 0,
    paying: 0,
    active: 0,
    ended: 0,
    blocked: 0,
  };
  const perDay = new Map<string, number>();
  const todayKey = tunisDateKey(now);
  const weekStartKey = tunisDateKey(new Date(now.getTime() - 6 * DAY_MS));
  const monthStartKey = tunisDateKey(new Date(now.getTime() - 29 * DAY_MS));
  const started = { today: 0, week: 0, month: 0, total: 0 };
  let firstKey: string | null = null;

  for (const profile of profiles) {
    if (!profile.free_access_until || !profile.created_at) continue;
    const status = trialStatus(profile, now);
    byStatus[status] += 1;
    if (status === "blocked") continue;

    const key = tunisDateKey(new Date(profile.created_at));
    started.total += 1;
    if (key === todayKey) started.today += 1;
    if (key >= weekStartKey) started.week += 1;
    if (key >= monthStartKey) started.month += 1;
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    if (!firstKey || key < firstKey) firstKey = key;
  }

  const daily: TrialDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = tunisDateKey(new Date(now.getTime() - i * DAY_MS));
    if (firstKey && key < firstKey) continue;
    daily.push({ date: key, count: perDay.get(key) ?? 0 });
  }

  return {
    started,
    byStatus,
    conversionPct: started.total ? Math.round((byStatus.paid / started.total) * 100) : null,
    daily: firstKey ? daily : [],
  };
}
