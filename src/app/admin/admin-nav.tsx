"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type Locale, t } from "@/lib/i18n";

type Tab = { href: string; label: Parameters<typeof t>[1]; badge?: number };

const TABS: Tab[] = [
  { href: "/admin", label: "admin.nav_payments" },
  { href: "/admin/subscriptions", label: "admin.nav_subs" },
  { href: "/admin/exercises", label: "admin.nav_exercises" },
  { href: "/admin/qa", label: "admin.nav_qa" },
  { href: "/admin/support", label: "admin.nav_support" },
  { href: "/admin/users", label: "admin.nav_users" },
];

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

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        const badge = tab.href === "/admin" ? pendingPayments : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-bold transition-colors",
              active
                ? "bg-accent text-bg"
                : "border border-hairline text-muted hover:text-ink",
            )}
          >
            {t(locale, tab.label)}
            {badge > 0 && (
              <span
                className={cn(
                  "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-bg/25 text-bg" : "bg-accent text-bg",
                )}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
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
  );
}
