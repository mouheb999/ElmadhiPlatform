import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cairo, tajawal } from "@/lib/fonts";
import { getLocale } from "@/lib/i18n-server";
import { dir } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELMADHI",
  description: "Your personal diet and training coach.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F0F0F",
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
      className={`${cairo.variable} ${tajawal.variable}`}
    >
      {/* Language switching lives in Settings only. */}
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
