/**
 * Browser side of Meta tracking. Client-safe: no secrets, no server imports.
 * The server side (Conversions API) lives in `capi.ts`.
 */

/**
 * The pixel id, or "" when none is configured — in which case no pixel loads
 * and no Conversions API event is sent. Inlined at `next build`, so it is the
 * same value on the server and in the bundle. See components/funnel/meta-pixel.
 */
const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const META_PIXEL_ID = /^\d{5,20}$/.test(RAW_PIXEL_ID) ? RAW_PIXEL_ID : "";

/**
 * Cookie the OAuth callback leaves for the browser to pick up. A Google
 * sign-up finishes in a redirect, so the page that could fire the browser
 * half of CompleteRegistration never saw the server half happen; this carries
 * the shared event id across. See `MetaPixel`.
 */
export const REGISTRATION_EVENT_COOKIE = "meta_reg_event";

/**
 * Only the event that needs an id shared with the server. Every other browser
 * event goes through `trackStep` in lib/funnel/track.ts.
 */
type StandardEvent = "CompleteRegistration";

/**
 * Fire a pixel event under an explicit event id. Nothing sensitive goes in
 * `params` — value and currency at most. Questionnaire, injury, weight and
 * goal data never do.
 *
 * `eventId` pairs this with the same event sent from the server, so Meta
 * counts it once.
 *
 * The pixel loads `afterInteractive`, so a very early call can beat it. Rather
 * than drop the event, retry briefly; if the pixel is blocked outright it
 * never arrives and this gives up quietly.
 */
export function trackMeta(
  event: StandardEvent,
  params?: { value?: number; currency?: "TND" },
  eventId?: string,
  attempt = 0,
): void {
  if (typeof window === "undefined") return;
  if (window.fbq) {
    if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
    else window.fbq("track", event, params ?? {});
    return;
  }
  if (attempt < 25) {
    setTimeout(() => trackMeta(event, params, eventId, attempt + 1), 200);
  }
}
