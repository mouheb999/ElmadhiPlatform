"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type Locale, t } from "@/lib/i18n";

type Tab = { href: string; label: Parameters<typeof t>[1] };

const TABS: Tab[] = [
  { href: "/admin", label: "admin.nav_payments" },
  { href: "/admin/foods", label: "admin.nav_foods" },
  { href: "/admin/exercises", label: "admin.nav_exercises" },
  { href: "/admin/qa", label: "admin.nav_qa" },
];

export function AdminNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition-colors",
              active
                ? "bg-accent text-bg"
                : "border border-hairline text-muted hover:text-ink",
            )}
          >
            {t(locale, tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
