import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cairo, saira, tajawal } from "@/lib/fonts";
import { getLocale } from "@/lib/i18n-server";
import { getCopyOverrides } from "@/lib/copy";
import { applyCopyOverrides, dir } from "@/lib/i18n";
import { CopyBootstrap } from "@/components/shared/copy-bootstrap";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F0F0F",
  // Let content extend under the notch/home-indicator; nav uses env(safe-area-inset-*).
  viewportFit: "cover",
};

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
    <html
      lang={lang}
      dir={dir(locale)}
      className={`${cairo.variable} ${saira.variable} ${tajawal.variable}`}
    >
      {/* Language switching lives in Settings only. */}
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        {/* Must stay first: it primes the client's i18n module before any
            sibling renders. See the component for why. */}
        <CopyBootstrap overrides={overrides} />
        {children}
      </body>
    </html>
  );
}
