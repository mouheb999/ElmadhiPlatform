"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setContacted } from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import { DEFAULT_LOCALE, isLocale, t, type Locale, type StringKey } from "@/lib/i18n";
import { formatPhone, whatsappLink } from "@/lib/phone";
import type { TrialStatus, TrialSummary } from "@/lib/trials";

export type TrialRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  userLocale: string | null;
  createdAt: string | null;
  status: TrialStatus;
  daysLeft: number | null;
  contactedAt: string | null;
};

/** Order is the order an admin works the list in: who can still be won first. */
const STATUSES: { key: TrialStatus; label: StringKey; tone: string }[] = [
  { key: "active", label: "admin.trials_active", tone: "border-accent/40 bg-accent/10 text-accent" },
  { key: "paying", label: "admin.trials_paying", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { key: "paid", label: "admin.trials_paid", tone: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  { key: "ended", label: "admin.trials_ended", tone: "border-hairline bg-white/5 text-muted" },
  { key: "blocked", label: "admin.trials_blocked", tone: "border-red-500/40 bg-red-500/10 text-red-400" },
];

/** Which WhatsApp opener fits where the person is. */
const WA_MESSAGE: Record<TrialStatus, StringKey> = {
  active: "admin.wa_msg_trial_active",
  ended: "admin.wa_msg_trial_ended",
  paying: "admin.wa_msg_active",
  paid: "admin.wa_msg_active",
  blocked: "admin.wa_msg_unpaid",
};

function waLink(row: TrialRow): string | null {
  const to = isLocale(row.userLocale) ? row.userLocale : DEFAULT_LOCALE;
  const message = t(to, WA_MESSAGE[row.status]).replace(
    "{name}",
    (row.name ?? "").split(" ")[0] || "",
  );
  return whatsappLink(row.phone, message);
}

// Fixed locale and Tunis time: the dates are compared down a column, and the
// accounts are in Tunisia whatever the admin's laptop thinks.
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const stampFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Tunis",
});

/** "2026-11-15" (already a Tunis day) → "15 Nov". */
function formatDayKey(key: string): string {
  return dayFmt.format(new Date(`${key}T00:00:00Z`));
}

function daysLeftLabel(locale: Locale, n: number): string {
  if (n === 1) return t(locale, "admin.trials_left_1");
  if (n === 2) return t(locale, "admin.trials_left_2");
  return t(locale, "admin.trials_left_n").replace("{n}", String(n));
}

export function TrialsClient({
  locale,
  summary,
  rows,
}: {
  locale: Locale;
  summary: TrialSummary;
  rows: TrialRow[];
}) {
  const [filter, setFilter] = useState<TrialStatus | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return (
        (row.name ?? "").toLowerCase().includes(q) ||
        (row.email ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && (row.phone ?? "").includes(digits))
      );
    });
  }, [rows, filter, query]);

  const periods: { label: StringKey; value: number }[] = [
    { label: "admin.trials_today", value: summary.started.today },
    { label: "admin.trials_week", value: summary.started.week },
    { label: "admin.trials_month", value: summary.started.month },
    { label: "admin.trials_total", value: summary.started.total },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* The headline: how many trials are being started. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-bold text-muted">
          {t(locale, "admin.trials_new_heading")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {periods.map((p, i) => (
            <div
              key={p.label}
              className={cn(
                "rounded-2xl border px-4 py-3",
                i === 0 ? "border-accent/40 bg-accent/10" : "border-hairline bg-surface",
              )}
            >
              <div className="text-3xl font-extrabold tabular-nums">{p.value}</div>
              <div className="text-xs font-bold text-muted">{t(locale, p.label)}</div>
            </div>
          ))}
        </div>
      </section>

      <DailyChart locale={locale} daily={summary.daily} />

      {/* What became of them. Tapping one filters the list below. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-muted">
            {t(locale, "admin.trials_outcomes")}
          </h2>
          {summary.conversionPct !== null && (
            <p className="text-sm">
              <span className="font-extrabold tabular-nums">{summary.conversionPct}%</span>{" "}
              <span className="text-muted">{t(locale, "admin.trials_conversion")}</span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUSES.map((s) => {
            const selected = filter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(selected ? "all" : s.key)}
                aria-pressed={selected}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-start transition-colors",
                  selected ? s.tone : "border-hairline bg-surface hover:border-white/20",
                )}
              >
                <div className="text-2xl font-extrabold tabular-nums">{summary.byStatus[s.key]}</div>
                <div className="text-xs font-bold text-muted">{t(locale, s.label)}</div>
              </button>
            );
          })}
        </div>
      </section>

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
          {t(locale, "admin.trials_none")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <TrialCard key={row.id} locale={locale} row={row} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted">{t(locale, "admin.trials_note")}</p>
    </div>
  );
}

/**
 * New trials per Tunis day. One series, so no legend — the heading names it.
 * Hover or focus a bar for its exact count; a table carries the same numbers
 * for screen readers.
 */
function DailyChart({ locale, daily }: { locale: Locale; daily: TrialSummary["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (daily.length === 0) return null;

  const max = Math.max(1, ...daily.map((d) => d.count));
  const shown = hover !== null ? daily[hover] : null;
  // A handful of date ticks, never one per bar: first, last, and one between.
  const ticks = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-bold">{t(locale, "admin.trials_daily")}</h2>
        <p className="text-xs tabular-nums text-muted" dir="ltr" aria-live="polite">
          {shown
            ? `${formatDayKey(shown.date)} · ${t(locale, "admin.trials_bar").replace("{n}", String(shown.count))}`
            : `max ${max}`}
        </p>
      </div>

      <div className="relative h-36" dir="ltr">
        {/* Recessive guides: the top of the scale and the baseline. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-hairline" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-hairline" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {daily.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${formatDayKey(d.date)}: ${d.count}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              // The hit target is the full column, not just the bar.
              className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-colors",
                  d.count === 0 ? "bg-white/10" : "bg-accent",
                  hover === i ? "opacity-100" : hover !== null ? "opacity-60" : "opacity-100",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ink",
                )}
                style={{ height: d.count === 0 ? 2 : `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-[2px] text-[10px] tabular-nums text-muted" dir="ltr">
        {daily.map((d, i) => (
          <span
            key={d.date}
            // The end labels hug their edge so they never run off the card.
            className={cn(
              "min-w-0 flex-1 overflow-visible whitespace-nowrap",
              i === 0 ? "text-left" : i === daily.length - 1 ? "flex justify-end" : "text-center",
            )}
          >
            {ticks.has(i) ? formatDayKey(d.date) : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{t(locale, "admin.trials_daily")}</caption>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TrialCard({ locale, row }: { locale: Locale; row: TrialRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const status = STATUSES.find((s) => s.key === row.status)!;
  const link = waLink(row);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">
          {row.name ?? row.email ?? (row.phone ? formatPhone(row.phone) : row.id.slice(0, 8))}
        </div>
        {row.email && (
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

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-end">
          <div className="text-sm tabular-nums" dir="ltr">
            {row.createdAt ? stampFmt.format(new Date(row.createdAt)) : "—"}
          </div>
          <div className="text-[11px] text-muted">
            {row.status === "active" && row.daysLeft !== null
              ? daysLeftLabel(locale, row.daysLeft)
              : t(locale, "admin.trials_signed_up")}
          </div>
        </div>

        <span className={cn("shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold", status.tone)}>
          {t(locale, status.label)}
        </span>

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title={row.contactedAt ? t(locale, "admin.contacted") : t(locale, "admin.not_contacted")}
            aria-label={row.contactedAt ? t(locale, "admin.contacted") : t(locale, "admin.wa_confirm")}
            // Marked as the link opens, same as the subscriptions list.
            onClick={() => {
              if (!row.contactedAt) {
                startTransition(async () => {
                  await setContacted(row.id, true);
                  router.refresh();
                });
              }
            }}
            className={cn(
              "shrink-0 rounded-full border p-1.5 transition-colors",
              row.contactedAt
                ? "border-hairline text-muted hover:border-white/20"
                : "border-accent/40 text-accent hover:bg-accent/10",
            )}
          >
            {row.contactedAt ? <CheckCheck className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          </a>
        )}
      </div>
    </div>
  );
}
