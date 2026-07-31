"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import type { SubscriptionStanding } from "@/lib/subscription";
import {
  countByStanding,
  filterRows,
  type StandingFilter,
  type SubscriptionRow,
} from "./filter";

export type { SubscriptionRow };

const STANDINGS: {
  key: SubscriptionStanding;
  label: StringKey;
  /** Chip + row accent. Expiring is amber because it is a to-do, not a fault. */
  tone: string;
}[] = [
  { key: "expiring", label: "admin.subs_expiring", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { key: "active", label: "admin.subs_active", tone: "border-accent/40 bg-accent/10 text-accent" },
  { key: "expired", label: "admin.subs_expired", tone: "border-red-500/40 bg-red-500/10 text-red-400" },
  { key: "unpaid", label: "admin.subs_unpaid", tone: "border-hairline bg-white/5 text-muted" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  // Fixed locale: an admin comparing dates down a column should not have to
  // decode two orderings, and the digits stay Western either way.
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * A count of days in Arabic, which does not pluralise like English: one is
 * "يوم", two has its own dual form "يومين", three to ten take the broken
 * plural "أيام", and eleven upwards goes back to the singular. Getting this
 * wrong reads as broken to a native speaker, and it shows on every row.
 */
function arabicDays(n: number): string {
  if (n === 1) return "يوم";
  if (n === 2) return "يومين";
  if (n <= 10) return `${n} أيام`;
  return `${n} يوم`;
}

/** "5 days left" / "12 days ago" / "—", without pulling in a date library. */
function relativeDays(locale: Locale, daysLeft: number | null): string {
  if (daysLeft === null) return "—";
  const n = Math.abs(daysLeft);
  if (daysLeft === 0) return locale === "tn" ? "اليوم" : "today";
  if (daysLeft > 0) {
    return locale === "tn" ? `باقي ${arabicDays(n)}` : `${n} day${n === 1 ? "" : "s"} left`;
  }
  return locale === "tn" ? `وفى من ${arabicDays(n)}` : `${n} day${n === 1 ? "" : "s"} ago`;
}

export function SubscriptionsClient({
  locale,
  rows,
}: {
  locale: Locale;
  rows: SubscriptionRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StandingFilter>("all");

  const counts = useMemo(() => countByStanding(rows), [rows]);
  const visible = useMemo(() => filterRows(rows, query, filter), [rows, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      {/* The headline numbers. Tapping one filters the list below it. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STANDINGS.map((standing) => {
          const selected = filter === standing.key;
          return (
            <button
              key={standing.key}
              type="button"
              onClick={() => setFilter(selected ? "all" : standing.key)}
              aria-pressed={selected}
              className={cn(
                "rounded-2xl border px-3 py-3 text-start transition-colors",
                selected ? standing.tone : "border-hairline bg-surface hover:border-white/20",
              )}
            >
              <div className="text-2xl font-extrabold tabular-nums">
                {counts[standing.key]}
              </div>
              <div className="text-xs font-bold text-muted">{t(locale, standing.label)}</div>
            </button>
          );
        })}
      </div>

      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute start-4 h-4 w-4 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "admin.subs_search")}
          className="ps-11"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-muted">
          {t(locale, "admin.subs_none")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => {
            const standing = STANDINGS.find((s) => s.key === row.standing)!;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-bold">
                      {row.name ?? row.email ?? row.id.slice(0, 8)}
                    </span>
                    {row.isAdmin && (
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0 text-accent"
                        aria-label={t(locale, "admin.subs_admin")}
                      />
                    )}
                  </div>
                  {row.email && (
                    <div className="truncate text-xs text-muted" dir="ltr">
                      {row.email}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  {row.planType && row.planType !== "free" && (
                    <span className="rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold text-muted">
                      {row.planType}
                    </span>
                  )}

                  <div className="text-end">
                    <div className="text-sm tabular-nums" dir="ltr">
                      {formatDate(row.expiresAt)}
                    </div>
                    <div className="text-[11px] text-muted">
                      {row.isAdmin
                        ? t(locale, "admin.subs_admin")
                        : relativeDays(locale, row.daysLeft)}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold",
                      standing.tone,
                    )}
                  >
                    {t(locale, standing.label)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted">{t(locale, "admin.subs_note")}</p>
    </div>
  );
}
