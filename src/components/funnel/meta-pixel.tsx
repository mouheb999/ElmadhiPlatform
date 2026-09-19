import { Suspense } from "react";
import Script from "next/script";
import { META_PIXEL_ID } from "@/lib/meta/pixel";
import { MetaPixelEvents } from "./meta-pixel-events";

/**
 * The Meta pixel, off by default.
 *
 * The acquisition channel is Instagram, and an ad account that is never told
 * what a subscription looks like can only optimise towards the thing it can
 * see: cheap landing-page views. This is the bridge that lets it optimise
 * towards the purchase instead — `lib/funnel/track.ts` sends the events.
 *
 * It renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set to a real pixel
 * id, so the default posture of this codebase — no third-party tracker, see
 * lib/funnel/attribution.ts — is unchanged until somebody opts in. The id is
 * checked here as well as in the script, because it is interpolated into an
 * attribute and a malformed value should produce no tag at all rather than a
 * broken one. next.config.ts widens the CSP for the same environment variable.
 */

export function MetaPixel() {
  if (!META_PIXEL_ID) return null;
  return (
    <>
      <Script
        id="meta-pixel"
        src="/meta-pixel.js"
        data-pixel-id={META_PIXEL_ID}
        strategy="afterInteractive"
      />
      {/* useSearchParams inside needs a boundary so static routes still prerender. */}
      <Suspense fallback={null}>
        <MetaPixelEvents />
      </Suspense>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
