import Script from "next/script";

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

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

export function MetaPixel() {
  if (!/^\d{5,20}$/.test(PIXEL_ID)) return null;
  return (
    <Script
      id="meta-pixel"
      src="/meta-pixel.js"
      data-pixel-id={PIXEL_ID}
      strategy="afterInteractive"
    />
  );
}
