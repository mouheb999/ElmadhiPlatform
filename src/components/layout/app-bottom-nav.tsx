"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, TrendingUp, Camera } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { type Locale, type StringKey, t } from "@/lib/i18n";

type Tab = { href: string; label: StringKey; icon: ComponentType<{ className?: string }> };

/**
 * The four everyday destinations, two either side of the scan button.
 *
 * Q&A and Settings used to sit here, which made six tabs — and six tabs on a
 * phone is a row of 44px targets with no gap worth speaking of. They moved into
 * the header, where they belong anyway: neither is part of the daily loop, and
 * Settings in particular is visited about once.
 *
 * Progress takes one of the freed slots because it is the thing the daily loop
 * is *for*. It is also paid, so an unpaid tap is redirected by `proxy.ts` —
 * to /checkout on the web, and in the app to /dashboard?locked=progress, which
 * names what they reached for instead of showing a price.
 */
const LEFT: Tab[] = [
  { href: "/dashboard", label: "nav.today", icon: Home },
  { href: "/workout", label: "nav.workouts", icon: Dumbbell },
];

const RIGHT: Tab[] = [
  { href: "/diet", label: "nav.food", icon: Utensils },
  { href: "/progress", label: "nav.progress", icon: TrendingUp },
];

/**
 * The tab's visual body. Rendered as a descendant of <Link> so it can read
 * `useLinkStatus()` — the instant `pending` flag lights the tapped tab up the
 * moment it's pressed, before the destination's server render returns, so the
 * nav never feels frozen even while the section is loading.
 */
function TabButton({
  Icon,
  active,
}: {
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full transition-all duration-200",
        active
          ? "bg-accent text-bg shadow-[0_6px_16px_-4px_rgba(192,218,27,0.6)]"
          : pending
            ? "bg-white/10 text-ink"
            : "text-muted",
      )}
    >
      <Icon className={cn("h-5 w-5 transition-transform", pending && !active && "animate-pulse")} />
    </span>
  );
}

/**
 * The scan button's body. Deliberately not a `TabButton`: it is the one action
 * in the bar rather than a place, so it keeps its accent fill whether or not
 * /ai is the current route, and it reads as a shutter.
 */
function ScanButton({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full bg-accent text-bg transition-all duration-200",
        "shadow-[0_8px_22px_-6px_rgba(192,218,27,0.75)]",
        (pending || active) && "scale-95",
      )}
    >
      <Camera className={cn("h-6 w-6", pending && "animate-pulse")} />
    </span>
  );
}

/** Floating glass pill nav — an inset bar with depth, not a full-bleed strip. */
export function AppBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tab = (t_: Tab) => (
    <Link
      key={t_.href}
      href={t_.href}
      // Prefetching is safe here and it is what makes a tap feel instant. Every
      // tab is `force-dynamic`, and Next only prefetches a dynamic route down to
      // its first loading boundary — the page segment itself is always refetched
      // on click, so today's logs, targets and sessions are never served stale.
      // What gets warmed is the route's JS chunk and the skeleton, which is
      // exactly the part the user was waiting on before.
      aria-current={isActive(t_.href) ? "page" : undefined}
      aria-label={t(locale, t_.label)}
      className="rounded-full outline-none transition-transform active:scale-90"
    >
      <TabButton Icon={t_.icon} active={isActive(t_.href)} />
    </Link>
  );

  return (
    <nav
      // `app-chrome` because this is chrome, not content: a long press on a tab
      // used to raise the text-selection handles — and Chrome's "copy link"
      // sheet — over the bar, which is the single clearest way a WebView
      // announces that it is a web page. See globals.css.
      className="app-chrome fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
      aria-label="Primary"
    >
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-surface/85 p-1.5 shadow-[0_16px_30px_-16px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        {LEFT.map(tab)}

        {/* The scan button sits in the bar's flow rather than floating above it.
            A raised FAB overlapping the pill looked right on a tall screen and
            collided with the content above on a short one. */}
        <Link
          href="/ai"
          aria-current={isActive("/ai") ? "page" : undefined}
          aria-label={t(locale, "nav.scan")}
          className="mx-1 rounded-full outline-none transition-transform active:scale-90"
        >
          <ScanButton active={isActive("/ai")} />
        </Link>

        {RIGHT.map(tab)}
      </div>
    </nav>
  );
}
