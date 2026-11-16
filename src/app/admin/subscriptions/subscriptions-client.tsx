"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCheck,
  MessageCircle,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, FilterChip, StatTile, adminCard } from "@/components/admin/kit";
import { deleteAccount, endSubscription } from "@/app/actions/subscriptions";
import { setContacted } from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LOCALE,
  isLocale,
  t,
  type Locale,
  type StringKey,
} from "@/lib/i18n";
import { formatPhone, whatsappLink } from "@/lib/phone";
import type { SubscriptionStanding } from "@/lib/subscription";
import {
  countByStanding,
  filterRows,
  type ContactFilter,
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
  { key: "expiring", label: "admin.subs_expiring", tone: "bg-learn/15 text-learn" },
  { key: "active", label: "admin.subs_active", tone: "bg-accent/15 text-accent" },
  { key: "expired", label: "admin.subs_expired", tone: "bg-danger/15 text-danger" },
  { key: "unpaid", label: "admin.subs_unpaid", tone: "bg-white/10 text-muted" },
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

/** Which chase message fits where this person stands. */
const WA_MESSAGE: Record<SubscriptionStanding, StringKey> = {
  unpaid: "admin.wa_msg_unpaid",
  expiring: "admin.wa_msg_expiring",
  expired: "admin.wa_msg_expired",
  active: "admin.wa_msg_active",
};

/**
 * A wa.me link with the chase already typed, in the customer's own language.
 * Null when there is no number on file, so the button is absent rather than
 * dead — most accounts predate the phone field and will stay null until their
 * owner next signs in.
 */
function waLink(row: SubscriptionRow): string | null {
  const to = isLocale(row.userLocale) ? row.userLocale : DEFAULT_LOCALE;
  const message = t(to, WA_MESSAGE[row.standing]).replace(
    "{name}",
    (row.name ?? "").split(" ")[0] || "",
  );
  return whatsappLink(row.phone, message);
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
  const [contact, setContact] = useState<ContactFilter>("all");

  const counts = useMemo(() => countByStanding(rows), [rows]);
  const visible = useMemo(
    () => filterRows(rows, query, filter, contact),
    [rows, query, filter, contact],
  );

  // Only counts people we could actually message — a row with no number can
  // never leave the "not contacted" pile, and padding the number with them
  // would make the list look permanently unfinished.
  const reachable = useMemo(
    () => rows.filter((r) => !r.isAdmin && r.phone),
    [rows],
  );
  const contactCounts = useMemo(
    () => ({
      all: reachable.length,
      contacted: reachable.filter((r) => r.contactedAt).length,
      uncontacted: reachable.filter((r) => !r.contactedAt).length,
    }),
    [reachable],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The headline numbers. Tapping one filters the list below it. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STANDINGS.map((standing) => (
          <StatTile
            key={standing.key}
            value={counts[standing.key]}
            label={t(locale, standing.label)}
            selected={filter === standing.key}
            onClick={() => setFilter(filter === standing.key ? "all" : standing.key)}
          />
        ))}
      </div>

      {/* Who still needs a message. Only people with a number are counted. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["uncontacted", "admin.not_contacted"],
            ["contacted", "admin.contacted"],
            ["all", "admin.contact_all"],
          ] as const
        ).map(([key, label]) => (
          <FilterChip
            key={key}
            selected={contact === key}
            onClick={() => setContact(key)}
            count={contactCounts[key]}
          >
            {t(locale, label)}
          </FilterChip>
        ))}
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
        <p className={cn(adminCard, "px-4 py-8 text-center text-sm text-muted")}>
          {t(locale, "admin.subs_none")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <RowCard key={row.id} locale={locale} row={row} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted">{t(locale, "admin.subs_note")}</p>
    </div>
  );
}

/** One account, with its two removal actions folded away until asked for. */
function RowCard({ locale, row }: { locale: Locale; row: SubscriptionRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const standing = STANDINGS.find((s) => s.key === row.standing)!;
  // Both actions refuse an admin server-side; not offering them is the honest
  // version of that, rather than a button that always fails.
  const removable = !row.isAdmin;
  const hasSubscription = row.standing !== "unpaid";
  const emailMatches =
    typedEmail.trim().toLowerCase() === (row.email ?? "").trim().toLowerCase() &&
    typedEmail.trim().length > 0;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      setConfirmingEnd(false);
      setTypedEmail("");
      // The list is server-rendered, so re-fetch rather than patch it here and
      // risk the row disagreeing with the database.
      router.refresh();
    });
  }

  return (
    <div className={cn(adminCard, "flex flex-col")}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={row.name ?? row.email} />
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
          {row.email && row.name && (
            <div className="truncate text-xs text-muted" dir="ltr">
              {row.email}
            </div>
          )}
          {row.phone && (
            <div className="truncate text-xs text-muted" dir="ltr">
              {formatPhone(row.phone)}
            </div>
          )}
        </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {row.planType && row.planType !== "free" && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold capitalize text-muted">
              {row.planType}
            </span>
          )}

          <div className="flex-1 text-end sm:flex-none">
            <div className="whitespace-nowrap text-sm tabular-nums" dir="ltr">
              {formatDate(row.expiresAt)}
            </div>
            <div className="whitespace-nowrap text-[11px] text-muted">
              {row.isAdmin ? t(locale, "admin.subs_admin") : relativeDays(locale, row.daysLeft)}
            </div>
          </div>

          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold",
              standing.tone,
            )}
          >
            {t(locale, standing.label)}
          </span>

          {!row.isAdmin && waLink(row) && (
            <a
              href={waLink(row)!}
              target="_blank"
              rel="noopener noreferrer"
              title={
                row.contactedAt
                  ? `${t(locale, "admin.contacted")} · ${formatDate(row.contactedAt)}`
                  : t(locale, "admin.not_contacted")
              }
              aria-label={
                row.contactedAt
                  ? t(locale, "admin.contacted")
                  : t(locale, "admin.wa_confirm")
              }
              // Marked as the link opens, so working the list keeps the list
              // honest without a second click.
              onClick={() => {
                if (!row.contactedAt) {
                  startTransition(async () => {
                    await setContacted(row.id, true);
                    router.refresh();
                  });
                }
              }}
              className={cn(
                "press grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
                row.contactedAt ? "bg-surface2 text-muted" : "bg-accent/15 text-accent",
              )}
            >
              {row.contactedAt ? (
                <CheckCheck className="h-4 w-4" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </a>
          )}

          {removable && (
            <button
              type="button"
              onClick={() => {
                setOpen((o) => !o);
                setConfirmingEnd(false);
                setError(null);
              }}
              aria-expanded={open}
              aria-label={t(locale, "admin.subs_actions")}
              title={t(locale, "admin.subs_actions")}
              className={cn(
                "press grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-surface2 transition-colors hover:text-ink",
                open ? "text-ink" : "text-muted",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && removable && (
        <div className="flex flex-col gap-3 border-t border-hairline p-4">
          {error && (
            <p className="rounded-2xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger">
              {error}
            </p>
          )}

          {/* The mis-tap, and the person worth another message later. */}
          {row.contactedAt && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 p-3">
              <p className="text-xs text-muted">
                {t(locale, "admin.contacted")} · {formatDate(row.contactedAt)}
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await setContacted(row.id, false);
                    if (!res.ok) setError(res.error ?? t(locale, "common.error"));
                    else router.refresh();
                  })
                }
              >
                {t(locale, "admin.mark_uncontacted")}
              </Button>
            </div>
          )}

          {/* Reversible: billing off, everything they logged stays. */}
          {hasSubscription && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3">
              <div>
                <div className="text-sm font-bold">{t(locale, "admin.subs_end")}</div>
                <p className="text-xs text-muted">{t(locale, "admin.subs_end_note")}</p>
              </div>
              {confirmingEnd ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => run(() => endSubscription(row.id))}
                    className="bg-learn/15 text-learn hover:bg-learn/25"
                  >
                    {t(locale, "admin.subs_end_confirm")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingEnd(false)}>
                    {t(locale, "admin.subs_cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmingEnd(true)}
                  className="self-start"
                >
                  {t(locale, "admin.subs_end")}
                </Button>
              )}
            </div>
          )}

          {/* Permanent. Guarded by typing the address, like the Users tab. */}
          <div className="flex flex-col gap-2 rounded-2xl bg-danger/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div>
                <div className="text-sm font-bold">{t(locale, "admin.subs_delete")}</div>
                <p className="text-xs text-muted">{t(locale, "admin.subs_delete_note")}</p>
              </div>
            </div>
            <Input
              dir="ltr"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              placeholder={row.email ?? ""}
              aria-label={t(locale, "admin.subs_delete_confirm_label")}
              className="h-10 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || !emailMatches}
              onClick={() => run(() => deleteAccount(row.id, typedEmail))}
              className="self-start bg-danger/15 text-danger hover:bg-danger/25"
            >
              <Trash2 />
              {t(locale, "admin.subs_delete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
