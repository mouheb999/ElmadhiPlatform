"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CircleHelp,
  Dumbbell,
  Flag,
  LayoutDashboard,
  Menu,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, type StringKey, t } from "@/lib/i18n";

type Tab = { href: string; label: StringKey; icon: LucideIcon };

/** The four an admin opens every day. On a phone these are the tab bar. */
const PRIMARY: Tab[] = [
  { href: "/admin", label: "admin.nav_overview", icon: LayoutDashboard },
  { href: "/admin/payments", label: "admin.nav_payments", icon: Wallet },
  { href: "/admin/trials", label: "admin.nav_trials", icon: Sparkles },
  { href: "/admin/subscriptions", label: "admin.nav_subs", icon: Users },
];

/** Everything else. On a phone these live behind "More". */
const SECONDARY: Tab[] = [
  { href: "/admin/support", label: "admin.nav_support", icon: Flag },
  { href: "/admin/qa", label: "admin.nav_qa", icon: CircleHelp },
  { href: "/admin/users", label: "admin.nav_users", icon: UserCog },
  { href: "/admin/exercises", label: "admin.nav_exercises", icon: Dumbbell },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function Badge({ n, inverted }: { n: number; inverted?: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        inverted ? "bg-bg/25 text-bg" : "bg-accent text-bg",
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function AdminNav({
  locale,
  pendingPayments = 0,
}: {
  locale: Locale;
  /**
   * Payment requests nobody has looked at yet — not simply "how many are
   * open". A request an admin has already seen and deliberately left open
   * would otherwise sit in the count forever, and a badge that never clears is
   * a badge nobody reads.
   */
  pendingPayments?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = SECONDARY.some((tab) => isActive(pathname, tab.href));

  return (
    <>
      {/* Tablet and up: every section as a pill, in the header. */}
      <nav className="hidden flex-wrap gap-2 md:flex">
        {[...PRIMARY, ...SECONDARY].map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-bold transition-colors",
                active
                  ? "bg-accent text-bg"
                  : "border border-hairline text-muted hover:text-ink",
              )}
            >
              {t(locale, tab.label)}
              {tab.href === "/admin/payments" && <Badge n={pendingPayments} inverted={active} />}
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="rounded-full border border-hairline px-4 py-2 font-display text-sm font-bold text-accent transition-colors hover:text-ink"
        >
          {t(locale, "admin.nav_app")}
        </Link>
      </nav>

      {/* Phone: a thumb-reach tab bar. Five slots at most, the rest in a sheet. */}
      <nav
        aria-label={t(locale, "admin.title")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {PRIMARY.map((tab) => {
            const active = isActive(pathname, tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                  {tab.href === "/admin/payments" && pendingPayments > 0 && (
                    <span className="absolute -end-2 -top-1.5">
                      <Badge n={pendingPayments} />
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t(locale, tab.label)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "press flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition-colors",
              moreActive ? "text-accent" : "text-muted",
            )}
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={moreActive ? 2.4 : 1.9} />
            <span>{t(locale, "admin.nav_more")}</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "admin.nav_more")}
          className="fixed inset-0 z-50 flex items-end md:hidden"
        >
          <button
            type="button"
            aria-label={t(locale, "admin.subs_cancel")}
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          />
          <div className="relative w-full rounded-t-[28px] border-t border-hairline bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-extrabold">{t(locale, "admin.nav_more")}</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t(locale, "admin.subs_cancel")}
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map((tab) => {
                const active = isActive(pathname, tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press flex min-h-[64px] items-center gap-3 rounded-2xl px-4 font-bold",
                      active ? "bg-accent/10 text-accent" : "bg-surface2 text-ink",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate text-sm">{t(locale, tab.label)}</span>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/dashboard"
              className="press mt-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-hairline text-sm font-bold text-accent"
            >
              {t(locale, "admin.nav_app")}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
