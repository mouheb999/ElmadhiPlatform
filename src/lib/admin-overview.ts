/**
 * Revenue numbers for the admin overview — counting only, no database access,
 * so it can be tested on plain rows.
 *
 * Revenue is confirmed payment requests, dated by when an admin confirmed
 * them (`resolved_at`), bucketed by Tunis calendar day.
 */

import { tunisDateKey } from "@/lib/dates";

export type ConfirmedPayment = {
  amount_tnd: number | string | null;
  resolved_at: string | null;
};

export type RevenueDay = { date: string; count: number };

export type RevenueSummary = {
  /** Confirmed this Tunis calendar month. */
  month: number;
  /** Confirmed last month up to the same day of the month — like for like. */
  lastMonthToDate: number;
  /** Whole of last month. */
  lastMonth: number;
  /** % change of `month` against `lastMonthToDate`; null with nothing to compare. */
  deltaPct: number | null;
  today: number;
  paymentsThisMonth: number;
  /** One entry per Tunis day, oldest first, ending today. `count` is dinars. */
  daily: RevenueDay[];
};

const DAY_MS = 86_400_000;

/** "2026-11" → "2026-10", across a year boundary too. */
function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function summarizeRevenue(
  payments: ConfirmedPayment[],
  now: Date = new Date(),
  days = 30,
): RevenueSummary {
  const todayKey = tunisDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  const lastKey = prevMonthKey(monthKey);
  const dayOfMonth = todayKey.slice(8);

  const perDay = new Map<string, number>();
  let month = 0;
  let lastMonth = 0;
  let lastMonthToDate = 0;
  let paymentsThisMonth = 0;

  for (const p of payments) {
    const amount = Number(p.amount_tnd);
    if (!p.resolved_at || !Number.isFinite(amount)) continue;
    const key = tunisDateKey(new Date(p.resolved_at));
    perDay.set(key, (perDay.get(key) ?? 0) + amount);
    if (key.startsWith(monthKey)) {
      month += amount;
      paymentsThisMonth += 1;
    } else if (key.startsWith(lastKey)) {
      lastMonth += amount;
      if (key.slice(8) <= dayOfMonth) lastMonthToDate += amount;
    }
  }

  const daily: RevenueDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = tunisDateKey(new Date(now.getTime() - i * DAY_MS));
    daily.push({ date: key, count: perDay.get(key) ?? 0 });
  }

  return {
    month,
    lastMonth,
    lastMonthToDate,
    deltaPct:
      lastMonthToDate > 0 ? Math.round(((month - lastMonthToDate) / lastMonthToDate) * 100) : null,
    today: perDay.get(todayKey) ?? 0,
    paymentsThisMonth,
    daily,
  };
}

/** Which greeting fits the Tunis hour: morning, afternoon or evening. */
export function dayPart(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = (now.getUTCHours() + 1) % 24; // Tunis is UTC+1 all year
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
