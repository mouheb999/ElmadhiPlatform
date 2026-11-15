/**
 * Getting out of Instagram's built-in browser.
 *
 * A link tapped in Instagram or Facebook does not open in the phone's browser.
 * It opens inside the app, in a stripped-down browser of its own, and for this
 * product that is a bad place to be:
 *
 *   - it cannot add the site to the home screen, so the app can never be
 *     "installed" from there;
 *   - it cannot receive reminders;
 *   - Google sign-in refuses to run in it;
 *   - its cookies are its own, so somebody who signs up there and later opens
 *     the site in Safari or Chrome is signed out and looks like a stranger.
 *
 * There is no official switch for this. What exists is one mechanism per
 * platform, and both are things the operating system does rather than things
 * Instagram promises:
 *
 *   - **Android** understands `intent://` links: "open this address in a
 *     browser app". This is long-standing and dependable.
 *   - **iOS** (17 and later) understands `x-safari-https://`, which opens the
 *     address in Safari. Older versions ignore it and nothing happens.
 *     Instagram's browser on iPhone refuses that address when a page goes to
 *     it by itself, and allows it when the visitor taps a link — so on iPhone
 *     the automatic attempt is skipped and a button is shown instead.
 *
 * So the page tries once, and when it is still inside the app a moment later
 * it shows one line telling the visitor how to do it by hand. Either company
 * can change this behaviour without notice; the manual line is what remains
 * true when they do.
 *
 * Client-safe, zero deps.
 */
export type InAppPlatform = "android" | "ios";

/** True for the browsers built into Instagram and Facebook. */
export function isInAppBrowser(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB/i.test(userAgent);
}

export function inAppPlatform(userAgent: string): InAppPlatform | null {
  if (!isInAppBrowser(userAgent)) return null;
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return null;
}

/**
 * The address that asks the phone to open `href` in a real browser, or null
 * when there is nothing to try (not an in-app browser, or not an https page).
 *
 * The full address is carried across — path, campaign parameters and Meta's
 * click id — because the ad that produced the visit is only knowable from
 * that query string, and a redirect that dropped it would make every
 * Instagram visitor look like direct traffic.
 */
export function externalBrowserUrl(userAgent: string, href: string): string | null {
  const platform = inAppPlatform(userAgent);
  if (!platform) return null;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (platform === "ios") return `x-safari-${url.href}`;

  // Chrome is named on purpose. Without a package Android shows its "open
  // with" chooser — a pop-up with a list of apps, which is one more decision
  // in front of somebody who only tapped a link. Naming Chrome goes straight
  // there on the phones that have it, which is nearly all of them. On one that
  // does not, the intent cannot be honoured and Android loads the fallback —
  // this same page — so the visitor simply stays where they are and is shown
  // the manual line.
  const target = `${url.host}${url.pathname}${url.search}`;
  return `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}
