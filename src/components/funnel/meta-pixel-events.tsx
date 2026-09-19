"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { REGISTRATION_EVENT_COOKIE, trackMeta } from "@/lib/meta/pixel";

/**
 * The two things the pixel bootstrap in public/meta-pixel.js cannot do on its
 * own, because they depend on the app rather than the page load.
 */
export function MetaPixelEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirst = useRef(true);

  // App Router navigations never reload the page, so the bootstrap's single
  // PageView would be the only one a visit ever reported.
  useEffect(() => {
    // The bootstrap already tracked the landing page.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname, searchParams]);

  // Browser half of a Google sign-up's CompleteRegistration. The OAuth
  // callback sent the server half and left the shared event id in a cookie,
  // because a redirect has no page of its own to fire from.
  useEffect(() => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${REGISTRATION_EVENT_COOKIE}=([^;]+)`),
    );
    if (!match) return;
    document.cookie = `${REGISTRATION_EVENT_COOKIE}=; Max-Age=0; Path=/`;
    trackMeta("CompleteRegistration", undefined, decodeURIComponent(match[1]));
  }, []);

  return null;
}
