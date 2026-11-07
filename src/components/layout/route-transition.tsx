"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Animates the screen change on every in-app navigation.
 *
 * Keyed on the pathname, so a navigation unmounts one ViewTransition and
 * mounts the next — that enter/exit pair is what React animates. Search-param
 * changes (the diet screen's ?view= tabs, ?locked=) keep the same pathname and
 * therefore the same key, so they update in place instead of replaying an
 * entrance for what is really the same screen.
 *
 * Which animation plays is decided by the link, not here: a tab in the bottom
 * bar tags its navigation `tab` (crossfade), a link that drills in tags it
 * `nav-forward`, a back link `nav-back`. Anything untagged — the first load, a
 * redirect, the hardware back button — maps to `none` and swaps instantly,
 * which is the right default: an animation nobody asked for is the
 * "web page loading" feel this exists to remove. The CSS for each lives at the
 * bottom of globals.css.
 */
const BY_TYPE = {
  tab: "tab-fade",
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}
