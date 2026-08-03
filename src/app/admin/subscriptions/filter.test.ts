import { describe, expect, it } from "vitest";
import { countByStanding, filterRows, type SubscriptionRow } from "./filter";

const row = (
  name: string | null,
  email: string | null,
  standing: SubscriptionRow["standing"],
  phone: string | null = null,
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
  phone,
  userLocale: "tn",
  contactedAt: null,
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

describe("filterRows — searching by phone", () => {
  const rows = [
    row("Bellila Bechir", "bellila@x.com", "unpaid", "+21626341616"),
    row("Ghaydaa", "ghaydaa@x.com", "active", "+21646973073"),
    row("No Number", "none@x.com", "unpaid", null),
  ];

  it("finds a number pasted out of WhatsApp, however it is spaced", () => {
    for (const q of ["26341616", "26 341 616", "+216 26 341 616", "21626341616"]) {
      expect(filterRows(rows, q, "all").map((r) => r.email)).toEqual([
        "bellila@x.com",
      ]);
    }
  });

  it("matches on a partial number", () => {
    expect(filterRows(rows, "4697", "all").map((r) => r.email)).toEqual([
      "ghaydaa@x.com",
    ]);
  });

  it("does not let a short digit string drag in every row", () => {
    // "26" alone is too weak to be a number search; it must not match the
    // person whose number merely contains it.
    expect(filterRows(rows, "26", "all")).toEqual([]);
  });

  it("still honours the standing filter", () => {
    expect(filterRows(rows, "26341616", "active")).toEqual([]);
  });
});

describe("filterRows — contacted vs not", () => {
  const withContact = (
    email: string,
    standing: SubscriptionRow["standing"],
    contactedAt: string | null,
  ): SubscriptionRow => ({ ...row(email, email, standing, "+21626341616"), contactedAt });

  const rows = [
    withContact("chased@x.com", "unpaid", "2026-08-02T10:00:00Z"),
    withContact("fresh@x.com", "unpaid", null),
    withContact("lapsed@x.com", "expired", null),
  ];

  it("defaults to showing everyone", () => {
    expect(filterRows(rows, "", "all")).toHaveLength(3);
  });

  it("narrows to the people still waiting on a message", () => {
    expect(filterRows(rows, "", "all", "uncontacted").map((r) => r.email)).toEqual([
      "fresh@x.com",
      "lapsed@x.com",
    ]);
  });

  it("narrows to the ones already chased", () => {
    expect(filterRows(rows, "", "all", "contacted").map((r) => r.email)).toEqual([
      "chased@x.com",
    ]);
  });

  it("combines with the standing tile rather than overriding it", () => {
    expect(filterRows(rows, "", "unpaid", "uncontacted").map((r) => r.email)).toEqual([
      "fresh@x.com",
    ]);
  });

  it("combines with the search box", () => {
    expect(filterRows(rows, "lapsed", "all", "uncontacted")).toHaveLength(1);
    expect(filterRows(rows, "lapsed", "all", "contacted")).toHaveLength(0);
  });
});
