import { describe, expect, it } from "vitest";
import { countByStanding, filterRows, type SubscriptionRow } from "./filter";

const row = (
  name: string | null,
  email: string | null,
  standing: SubscriptionRow["standing"],
): SubscriptionRow => ({
  id: `${email ?? name}`,
  name,
  email,
  standing,
  isAdmin: false,
  planType: "premium",
  expiresAt: null,
  paidAt: null,
  daysLeft: null,
});

const ROWS: SubscriptionRow[] = [
  row("Nour Tomorrow", "nour@example.com", "expiring"),
  row("Amine Active", "amine@example.com", "active"),
  row("Leila Lapsed", "leila@example.com", "expired"),
  row("Omar LongGone", "omar@example.com", "expired"),
  row("Nadia NeverPaid", "nadia@example.com", "unpaid"),
  row(null, "no-name@example.com", "active"),
  row("No Email", null, "unpaid"),
];

const emails = (rows: SubscriptionRow[]) => rows.map((r) => r.email ?? r.name);

describe("filterRows", () => {
  it("shows everyone by default", () => {
    expect(filterRows(ROWS, "", "all")).toHaveLength(ROWS.length);
  });

  it("narrows to one standing when a tile is selected", () => {
    expect(emails(filterRows(ROWS, "", "expired"))).toEqual([
      "leila@example.com",
      "omar@example.com",
    ]);
  });

  it("matches on email and on name", () => {
    expect(emails(filterRows(ROWS, "leila@", "all"))).toEqual(["leila@example.com"]);
    expect(emails(filterRows(ROWS, "LongGone", "all"))).toEqual(["omar@example.com"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(emails(filterRows(ROWS, "  NOUR  ", "all"))).toEqual(["nour@example.com"]);
  });

  it("combines the search box with the selected tile", () => {
    // "a" appears in most rows; the tile still has to hold.
    const result = filterRows(ROWS, "a", "expired");
    expect(result.every((r) => r.standing === "expired")).toBe(true);
    expect(emails(result)).toEqual(["leila@example.com", "omar@example.com"]);
  });

  it("survives a row with no name or no email", () => {
    expect(emails(filterRows(ROWS, "no-name", "all"))).toEqual(["no-name@example.com"]);
    expect(emails(filterRows(ROWS, "No Email", "all"))).toEqual(["No Email"]);
  });

  it("returns nothing rather than everything when a search matches no one", () => {
    expect(filterRows(ROWS, "zzzznobody", "all")).toEqual([]);
  });
});

describe("countByStanding", () => {
  it("counts every standing, including the empty ones", () => {
    expect(countByStanding(ROWS)).toEqual({ active: 2, expiring: 1, expired: 2, unpaid: 2 });
    expect(countByStanding([])).toEqual({ active: 0, expiring: 0, expired: 0, unpaid: 0 });
  });

  it("agrees with what the list shows for that tile", () => {
    const counts = countByStanding(ROWS);
    for (const standing of ["active", "expiring", "expired", "unpaid"] as const) {
      expect(filterRows(ROWS, "", standing)).toHaveLength(counts[standing]);
    }
  });
});
