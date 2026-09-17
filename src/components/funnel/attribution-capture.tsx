"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/funnel/client-store";

/**
 * Reads the ad parameters off the URL and keeps them. Renders nothing.
 *
 * Mounted on every public entry point, because an ad can be pointed at any of
 * them and the query string survives exactly one page load. A visit carrying
 * no campaign parameters leaves whatever is already stored alone, so this is
 * safe to mount on pages that ordinary traffic also reaches.
 *
 * A client component rather than something in the page or the proxy: a Server
 * Component cannot set a cookie during render, and putting these pages in the
 * proxy's matcher would buy every ad click an auth round-trip it has no use
 * for.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
