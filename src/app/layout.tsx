import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cairo, saira, tajawal } from "@/lib/fonts";
import { getLocale } from "@/lib/i18n-server";
import { dir } from "@/lib/i18n";
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
  const locale = await getLocale();
  const lang = locale === "tn" ? "ar" : "en";

  return (
    <html
      lang={lang}
      dir={dir(locale)}
      className={`${cairo.variable} ${saira.variable} ${tajawal.variable}`}
    >
      {/* Language switching lives in Settings only. */}
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
