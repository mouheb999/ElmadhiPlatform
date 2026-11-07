"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, TrendingUp, Camera } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { type Locale, type StringKey, t } from "@/lib/i18n";

type Tab = { href: string; label: StringKey; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

/** Two either side of the scan button. Order mirrors automatically in RTL. */
const LEFT: Tab[] = [
  { href: "/dashboard", label: "nav.today", icon: Home },
  { href: "/workout", label: "nav.workouts", icon: Dumbbell },
];
const RIGHT: Tab[] = [
  { href: "/diet", label: "nav.food", icon: Utensils },
  { href: "/progress", label: "nav.progress", icon: TrendingUp },
];

/**
 * One tab's body. A descendant of <Link> so it can read `useLinkStatus()`:
 * the tapped tab tints the instant it is pressed, before the next screen's
 * server render returns, so the bar never feels like it ignored the tap.
 */
function TabBody({ tab, active, locale }: { tab: Tab; active: boolean; locale: Locale }) {
  const { pending } = useLinkStatus();
  const Icon = tab.icon;
  const lit = active || pending;
  return (
    <span
      className={cn(
        "flex h-[52px] flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold transition-colors duration-200",
        lit ? "text-accent" : "text-subtle",
      )}
    >
      <Icon className={cn("h-6 w-6", pending && !active && "animate-pulse")} strokeWidth={active ? 2.1 : 1.8} />
      {t(locale, tab.label)}
    </span>
  );
}

/**
 * The tab bar, drawn the way native apps draw it: full width, labelled, and
 * translucent, so content scrolling underneath shows through a blur instead
 * of disappearing behind a slab.
 *
 * It replaces a floating glass pill. The pill looked good in a screenshot and
 * wrong in the hand — no labels, so the icons had to be learned; inset from
 * the edges, so it read as a web widget floating over a page rather than part
 * of the app's frame.
 *
 * Lime marks the current tab and nothing else here, so where you are is the
 * one bright thing in the bar. The scan button is white rather than lime: it
 * is an action, not a place, and a second bright thing would compete with it.
 *
 * Every tab tags its navigation `tab`, which RouteTransition turns into a
 * crossfade — moving sideways between equals, no direction implied.
 */
export function AppBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const renderTab = (tab: Tab) => (
    <Link
      key={tab.href}
      href={tab.href}
      transitionTypes={["tab"]}
      aria-current={isActive(tab.href) ? "page" : undefined}
      aria-label={t(locale, tab.label)}
      className="press outline-none"
    >
      <TabBody tab={tab} active={isActive(tab.href)} locale={locale} />
    </Link>
  );

  return (
    <nav
      aria-label="Primary"
      // Pinned out of screen transitions so the bar stays still while the
      // content behind it changes; see ::view-transition-group(app-tabbar).
      style={{ viewTransitionName: "app-tabbar" }}
      className="app-chrome fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t-[0.5px] border-white/[0.12] bg-[rgba(20,20,20,0.72)] px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] backdrop-blur-xl backdrop-saturate-[1.8]"
    >
      {LEFT.map(renderTab)}
      <Link
        href="/ai"
        transitionTypes={["tab"]}
        aria-current={isActive("/ai") ? "page" : undefined}
        aria-label={t(locale, "nav.scan")}
        className="press grid h-[50px] w-[50px] place-items-center justify-self-center rounded-full bg-ink text-bg outline-none"
      >
        <Camera className="h-[23px] w-[23px]" strokeWidth={2} />
      </Link>
      {RIGHT.map(renderTab)}
    </nav>
  );
}
