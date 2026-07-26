"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

export type NutritionView = "today" | "plan";

/**
 * Segmented control for the unified /diet home. State lives in the URL
 * (`?view=today|plan`) so the server renders the right view, the back button
 * works, and links are shareable — `current` comes from the server page.
 */
export function NutritionTabs({ current, locale }: { current: NutritionView; locale: Locale }) {
  const tabs: { view: NutritionView; href: string; label: "nutrition.tab_today" | "nutrition.tab_plan" }[] = [
    { view: "today", href: "/diet?view=today", label: "nutrition.tab_today" },
    { view: "plan", href: "/diet?view=plan", label: "nutrition.tab_plan" },
  ];

  return (
    <div className="flex gap-1 rounded-full border border-hairline bg-surface p-1" role="tablist">
      {tabs.map((tab) => {
        const active = tab.view === current;
        return (
          <Link
            key={tab.view}
            href={tab.href}
            // No prefetch: `prefetch` opts a route into the client cache's
            // 5-minute "static" stale time, which served stale targets and
            // stale logged meals. These views must always render live data.
            prefetch={false}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex-1 rounded-full py-2 text-center text-sm font-bold outline-none transition-colors",
              active ? "bg-accent text-bg" : "text-muted hover:text-ink",
            )}
          >
            {t(locale, tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
