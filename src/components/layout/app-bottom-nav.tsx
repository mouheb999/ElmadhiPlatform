"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, Sparkles, MessageCircleQuestion, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, t } from "@/lib/i18n";

const TABS = [
  { href: "/dashboard", label: "nav.home", icon: Home },
  { href: "/workout", label: "nav.workouts", icon: Dumbbell },
  { href: "/diet", label: "nav.nutrition", icon: Utensils },
  { href: "/ai", label: "nav.ai", icon: Sparkles },
  { href: "/qa", label: "nav.qa", icon: MessageCircleQuestion },
  { href: "/settings", label: "nav.profile", icon: User },
] as const;

/** Floating glass pill nav — an inset bar with depth, not a full-bleed strip. */
export function AppBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4" aria-label="Primary">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-surface/85 p-1.5 shadow-[0_16px_30px_-16px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={t(locale, label)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full transition-colors",
                active ? "bg-accent text-bg shadow-[0_6px_16px_-4px_rgba(93,214,44,0.6)]" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
