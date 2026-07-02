// EXAMPLE root layout — shows how to wire the brand fonts + dark theme.
// Rename to `layout.tsx` (or merge into your existing one). If you use next-intl
// with a [locale] segment, set `dir` from the locale instead of hardcoding it.

import type { ReactNode } from "react";
import { cairo, tajawal } from "@/lib/fonts";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <body className="font-sans bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
