import type { SubscriptionStanding } from "@/lib/subscription";

export type SubscriptionRow = {
  id: string;
  name: string | null;
  email: string | null;
  standing: SubscriptionStanding;
  isAdmin: boolean;
  planType: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  daysLeft: number | null;
};

export type StandingFilter = SubscriptionStanding | "all";

/**
 * What the list shows for a given search box and selected tile.
 *
 * Kept out of the component so it can be tested without a browser: the whole
 * point of the page is finding one person in a list of hundreds, and a search
 * that quietly matches nothing is worse than no search at all.
 */
export function filterRows(
  rows: SubscriptionRow[],
  query: string,
  filter: StandingFilter,
): SubscriptionRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter !== "all" && row.standing !== filter) return false;
    if (!needle) return true;
    return (
      (row.email ?? "").toLowerCase().includes(needle) ||
      (row.name ?? "").toLowerCase().includes(needle)
    );
  });
}

/** Tile counts, so the numbers can never disagree with the rows beneath them. */
export function countByStanding(
  rows: SubscriptionRow[],
): Record<SubscriptionStanding, number> {
  const counts: Record<SubscriptionStanding, number> = {
    active: 0,
    expiring: 0,
    expired: 0,
    unpaid: 0,
  };
  for (const row of rows) counts[row.standing]++;
  return counts;
}
