import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flag,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import type { RevenueSummary } from "@/lib/admin-overview";
import { DayBars } from "@/components/admin/day-bars";

export type OverviewData = {
  /** First name, or null when the account has none on file. */
  adminName: string | null;
  greeting: "morning" | "afternoon" | "evening";
  /** e.g. "Sunday, 15 November" — formatted on the server, one clock. */
  dateLabel: string;
  revenue: RevenueSummary;
  queue: {
    pendingPayments: number;
    pendingAmount: number;
    /** Hours the oldest pending payment has waited; null with none pending. */
    oldestPendingHours: number | null;
    openTickets: number;
    pendingQuestions: number;
    trialsEndingSoon: number;
    expiringSubs: number;
  };
  kpis: {
    activeSubscribers: number;
    inTrial: number;
    newTrials7d: number;
    signups7d: number;
  };
  recent: { id: string; name: string; amount: number; when: string }[];
};

/** 1769 → "1,769". Western digits in both languages, like the rest of the panel. */
function money(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

type QueueItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  tone: string;
  count: number;
  label: StringKey;
  detail?: string;
};

/**
 * The admin's home screen: what came in, what is waiting on a person, and
 * where the business stands — in that order, because on a phone the first
 * screenful is the only one guaranteed to be read.
 *
 * Presentational only: every number arrives as a prop, already counted.
 */
export function OverviewView({ locale, data }: { locale: Locale; data: OverviewData }) {
  const { revenue, queue, kpis } = data;

  const waitDetail =
    queue.oldestPendingHours === null
      ? undefined
      : queue.oldestPendingHours >= 48
        ? t(locale, "admin.ov_wait_days").replace("{n}", String(Math.floor(queue.oldestPendingHours / 24)))
        : t(locale, "admin.ov_wait_hours").replace("{n}", String(Math.max(1, queue.oldestPendingHours)));

  const items: QueueItem[] = (
    [
      {
        key: "payments",
        href: "/admin/payments",
        icon: Wallet,
        tone: "bg-accent/15 text-accent",
        count: queue.pendingPayments,
        label: "admin.ov_q_payments",
        detail: [
          t(locale, "admin.ov_dt").replace("{n}", money(queue.pendingAmount)),
          waitDetail,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        key: "tickets",
        href: "/admin/support",
        icon: Flag,
        tone: "bg-fuel/15 text-fuel",
        count: queue.openTickets,
        label: "admin.ov_q_tickets",
      },
      {
        key: "questions",
        href: "/admin/qa",
        icon: CircleHelp,
        tone: "bg-learn/15 text-learn",
        count: queue.pendingQuestions,
        label: "admin.ov_q_questions",
      },
      {
        key: "trials",
        href: "/admin/trials",
        icon: Clock3,
        tone: "bg-protein/15 text-protein",
        count: queue.trialsEndingSoon,
        label: "admin.ov_q_trials",
      },
      {
        key: "expiring",
        href: "/admin/subscriptions",
        icon: Users,
        tone: "bg-body/15 text-body",
        count: queue.expiringSubs,
        label: "admin.ov_q_expiring",
      },
    ] satisfies QueueItem[]
  ).filter((item) => item.count > 0);

  const tiles: { href: string; icon: LucideIcon; tone: string; value: number; label: StringKey }[] = [
    { href: "/admin/subscriptions", icon: Users, tone: "text-accent", value: kpis.activeSubscribers, label: "admin.ov_k_subs" },
    { href: "/admin/trials", icon: Sparkles, tone: "text-protein", value: kpis.inTrial, label: "admin.ov_k_in_trial" },
    { href: "/admin/trials", icon: TrendingUp, tone: "text-learn", value: kpis.newTrials7d, label: "admin.ov_k_trials7" },
    { href: "/admin/users", icon: UserPlus, tone: "text-body", value: kpis.signups7d, label: "admin.ov_k_signups7" },
  ];

  const up = revenue.deltaPct !== null && revenue.deltaPct >= 0;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{data.dateLabel}</p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">
            {t(locale, `admin.ov_hi_${data.greeting}`)}
            {data.adminName ? (
              <>
                {locale === "tn" ? "، " : ", "}
                <span className="text-accent">{data.adminName}</span>
              </>
            ) : null}
          </h1>
        </header>

        {/* The headline: money that actually arrived this month. */}
        <section className="relative overflow-hidden rounded-[28px] border border-hairline bg-surface p-5">
          <div
            aria-hidden
            className="glow-accent pointer-events-none absolute -end-24 -top-28 h-72 w-72 opacity-70"
          />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-muted">{t(locale, "admin.ov_revenue")}</h2>
                <p className="mt-1 flex items-baseline gap-2" dir="ltr">
                  <span className="font-num text-[44px] font-extrabold leading-none tabular-nums tracking-tight">
                    {money(revenue.month)}
                  </span>
                  <span className="text-base font-bold text-muted">DT</span>
                </p>
              </div>
              {revenue.deltaPct !== null && (
                <span
                  className={cn(
                    "mt-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                    up ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger",
                  )}
                  title={t(locale, "admin.ov_vs_last")}
                  dir="ltr"
                >
                  {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {up ? "+" : ""}
                  {revenue.deltaPct}%
                </span>
              )}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-start">
              {(
                [
                  ["admin.ov_today", `${money(revenue.today)} DT`],
                  ["admin.ov_payments_n", String(revenue.paymentsThisMonth)],
                  ["admin.ov_last_month", `${money(revenue.lastMonth)} DT`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                  <dt className="truncate text-[11px] font-bold text-muted">{t(locale, label)}</dt>
                  <dd className="mt-0.5 text-sm font-extrabold tabular-nums" dir="ltr">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <DayBars
              daily={revenue.daily}
              caption={t(locale, "admin.ov_revenue_daily")}
              valueTemplate="{n} DT"
              heightClass="h-24"
            />
            {revenue.deltaPct !== null && (
              <p className="text-[11px] text-muted">{t(locale, "admin.ov_vs_last")}</p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className="press flex flex-col gap-3 rounded-[22px] border border-hairline bg-surface p-4 transition-colors hover:border-white/20"
              >
                <Icon className={cn("h-5 w-5", tile.tone)} />
                <div>
                  <div className="font-num text-3xl font-extrabold leading-none tabular-nums" dir="ltr">
                    {tile.value}
                  </div>
                  <div className="mt-1.5 text-xs font-bold text-muted">{t(locale, tile.label)}</div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>

      <div className="flex flex-col gap-6">
        {/* What is waiting on a person. Empty is a state worth celebrating. */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold tracking-tight">{t(locale, "admin.ov_queue")}</h2>
            {items.length > 0 && (
              <span className="text-xs font-bold tabular-nums text-muted">
                {t(locale, "admin.ov_queue_n").replace(
                  "{n}",
                  String(items.reduce((sum, item) => sum + item.count, 0)),
                )}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-accent/30 bg-accent/10 p-5">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-accent" />
              <div>
                <p className="font-extrabold">{t(locale, "admin.ov_clear_title")}</p>
                <p className="text-sm text-muted">{t(locale, "admin.ov_clear_sub")}</p>
              </div>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.key} className={cn(i > 0 && "border-t border-hairline")}>
                    <Link
                      href={item.href}
                      className="press flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", item.tone)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{t(locale, item.label)}</span>
                        {item.detail && (
                          <span className="block truncate text-xs text-muted">{item.detail}</span>
                        )}
                      </span>
                      <span className="font-num text-2xl font-extrabold tabular-nums" dir="ltr">
                        {item.count}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:-scale-x-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold tracking-tight">{t(locale, "admin.ov_recent")}</h2>
          {data.recent.length === 0 ? (
            <p className="rounded-[22px] border border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
              {t(locale, "admin.ov_recent_none")}
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
              {data.recent.map((p, i) => (
                <li
                  key={p.id}
                  className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-hairline")}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-extrabold uppercase text-accent">
                    {p.name.trim().charAt(0) || "·"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.name}</span>
                    <span className="block text-xs tabular-nums text-muted" dir="ltr">
                      {p.when}
                    </span>
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-accent" dir="ltr">
                    +{money(p.amount)} DT
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
