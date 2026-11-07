"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, TrendingUp, Camera } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { type Locale, type StringKey, t } from "@/lib/i18n";

type Tab = {
  href: string;
  label: StringKey;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Drawn inside a filled disc — the one action in a bar of places. */
  disc?: boolean;
};

/** Order mirrors automatically in RTL. */
const TABS: Tab[] = [
  { href: "/dashboard", label: "nav.today", icon: Home },
  { href: "/workout", label: "nav.workouts", icon: Dumbbell },
  { href: "/ai", label: "nav.scan_short", icon: Camera, disc: true },
  { href: "/diet", label: "nav.food", icon: Utensils },
  { href: "/progress", label: "nav.progress", icon: TrendingUp },
];

/**
 * One tab. A descendant of <Link> so it can read `useLinkStatus()`: the tapped
 * tab lights up the instant it is pressed, before the next screen's server
 * render returns, so the bar never feels like it ignored the tap.
 */
function TabBody({ tab, active, locale }: { tab: Tab; active: boolean; locale: Locale }) {
  const { pending } = useLinkStatus();
  const lit = active || pending;
  const Icon = tab.icon;
  return (
    <span
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-[3px] rounded-[26px] text-[11px] font-semibold transition-colors duration-300",
        // The selected tab sits in a darker pill inside the capsule.
        active ? "bg-[#131313]" : "bg-transparent",
        lit ? "text-accent" : "text-ink",
      )}
    >
      {tab.disc ? (
        <span
          className={cn(
            "grid h-[26px] w-[26px] place-items-center rounded-full transition-colors duration-300",
            lit ? "bg-accent text-bg" : "bg-ink text-bg",
          )}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2.4} />
        </span>
      ) : (
        <Icon className={cn("h-[25px] w-[25px]", pending && !active && "animate-pulse")} strokeWidth={active ? 2.2 : 1.9} />
      )}
      {t(locale, tab.label)}
    </span>
  );
}

/**
 * The tab bar: a floating capsule, matched to the reference design's colours.
 *
 * The capsule is #2A2A2A — translucent over a blur, so content scrolling under
 * it tints it — with a barely-there rim. The selected tab sits in a darker
 * #131313 pill inside it, with its icon and label in lime; every other tab is
 * plain white. Scan keeps its place in the middle, its camera in a white disc,
 * so it reads as the bar's one action without breaking the row.
 *
 * Every tab tags its navigation `tab`, which RouteTransition turns into a
 * crossfade — moving sideways between equals, no direction implied.
 */
export function AppBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary"
      // Pinned out of screen transitions so the bar stays still while the
      // content behind it changes; see ::view-transition-group(app-tabbar).
      style={{ viewTransitionName: "app-tabbar" }}
      className="app-chrome fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 mx-auto grid max-w-md grid-cols-5 gap-0.5 rounded-[32px] border-[0.5px] border-white/[0.06] bg-[rgba(42,42,42,0.86)] p-1.5 backdrop-blur-2xl backdrop-saturate-[1.6]"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          transitionTypes={["tab"]}
          aria-current={isActive(tab.href) ? "page" : undefined}
          aria-label={tab.disc ? t(locale, "nav.scan") : t(locale, tab.label)}
          className="press rounded-[26px] outline-none"
        >
          <TabBody tab={tab} active={isActive(tab.href)} locale={locale} />
        </Link>
      ))}
    </nav>
  );
}
