import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cairo, inter, saira, tajawal } from "@/lib/fonts";
import { getLocale } from "@/lib/i18n-server";
import { getCopyOverrides } from "@/lib/copy";
import { applyCopyOverrides, dir } from "@/lib/i18n";
import { CopyBootstrap } from "@/components/shared/copy-bootstrap";
import { MetaPixel } from "@/components/funnel/meta-pixel";
import { SerwistProvider } from "@serwist/turbopack/react";
import { isAppShell } from "@/lib/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HYPE FITNESS", template: "%s · HYPE FITNESS" },
  description: "Your personal diet and training coach.",
  applicationName: "HYPE FITNESS",
  // Launch standalone from the iOS home screen with the HYPE FITNESS name + dark status bar.
  appleWebApp: {
    capable: true,
    title: "HYPE FITNESS",
    statusBarStyle: "black-translucent",
  },
  // See the `translate="no"` note on <html> below. This is Google's older,
  // Google-specific spelling of the same instruction; both are honoured.
  other: { google: "notranslate" },
};

/**
 * The viewport, decided per request because the app and the web want
 * different things from pinch-zoom.
 *
 * On the web it stays on. Disabling zoom is an accessibility cost — somebody
 * with poor eyesight reading a meal plan on a phone browser needs it — and a
 * web page is expected to zoom.
 *
 * In the Android app it goes. A native screen does not zoom, and in testing
 * the cost was concrete rather than cosmetic: one stray pinch left the whole
 * app magnified and cut off at both sides, with no visual hint that it was
 * zoomed or how to get back. Android's own accessibility settings (font size,
 * display size, the magnification gesture) still work, and those are what a
 * user who needs larger text in an app reaches for.
 *
 * `generateViewport` can read the request because this layout already reads
 * the locale cookie, so every route below it is dynamic anyway — nothing is
 * moved off a static shell by this.
 */
export async function generateViewport(): Promise<Viewport> {
  const appShell = await isAppShell();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: appShell ? 1 : 5,
    ...(appShell ? { userScalable: false } : {}),
    themeColor: "#000000",
    // Let content extend under the notch/home-indicator; nav uses env(safe-area-inset-*).
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, overrides] = await Promise.all([getLocale(), getCopyOverrides()]);
  const lang = locale === "tn" ? "ar" : "en";

  // Applied here, before any child renders, so every server component below
  // resolves published copy rather than the built-in defaults.
  applyCopyOverrides(overrides);

  return (
    // `translate="no"`: Chrome must never offer to translate this app.
    //
    // Switching the language in Settings changes <html lang>, and Chrome reads
    // that as "a page in a language you might not read" and raises its
    // "Translate this page?" bar. Inside the app that is browser chrome
    // appearing over a native-looking screen; on the web it is noise, since
    // the product already speaks both languages.
    //
    // It is also a correctness problem, not just a cosmetic one. Chrome's
    // translator rewrites text nodes in place, behind React's back, and React
    // then crashes the next time it reconciles a node that is no longer the
    // one it rendered — the familiar "Failed to execute 'removeChild'" error.
    // An app that offers to break itself is worth switching off everywhere.
    <html
      lang={lang}
      dir={dir(locale)}
      translate="no"
      className={`${inter.variable} ${cairo.variable} ${saira.variable} ${tajawal.variable}`}
    >
      {/* Language switching lives in Settings only. */}
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        {/* Must stay first: it primes the client's i18n module before any
            sibling renders. See the component for why. */}
        <CopyBootstrap overrides={overrides} />
        {/* Registers /serwist/sw.js. Here rather than in the (app) layout
            because installability is judged on whatever page the user happens
            to be on, and because the precached /~offline page must be fetched
            whether they arrived at the dashboard or the landing page.

            Off in development: dev CSS and JS chunks keep the same URL when
            their contents change, and the worker caches /_next/static/ as if
            it never changed, so edits silently stop showing up. Production
            chunk names are content-hashed, so this cannot happen there. Test
            offline behaviour against `npm run build && npm start`. */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
          {children}
        </SerwistProvider>
        {/* Renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set. Here rather
            than on /start alone because the funnel spans four routes — the
            questionnaire, the offer, sign-up and the payment screen — and a
            pixel that only exists on the first one can report arrivals and
            nothing else. */}
        <MetaPixel />
      </body>
    </html>
  );
}
