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
  phone: string | null;
  /** The customer's own language — the WhatsApp draft is written in it. */
  userLocale: string | null;
  /** When an admin last messaged them, or null if nobody has. */
  contactedAt: string | null;
};

export type StandingFilter = SubscriptionStanding | "all";

/** Whether the list is narrowed to people who still need a message. */
export type ContactFilter = "all" | "contacted" | "uncontacted";

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
  contact: ContactFilter = "all",
): SubscriptionRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter !== "all" && row.standing !== filter) return false;
    if (contact === "contacted" && !row.contactedAt) return false;
    if (contact === "uncontacted" && row.contactedAt) return false;
    if (!needle) return true;
    return (
      (row.email ?? "").toLowerCase().includes(needle) ||
      (row.name ?? "").toLowerCase().includes(needle) ||
      // Digits only, so "26 341 616" finds "+21626341616": an admin pasting a
      // number out of WhatsApp should not have to guess the stored format.
      (needle.replace(/\D/g, "").length >= 4 &&
        (row.phone ?? "").replace(/\D/g, "").includes(needle.replace(/\D/g, "")))
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
