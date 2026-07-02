import { Cairo, Tajawal } from "next/font/google";

/**
 * ELMADHI brand fonts. Import these in your root (or [locale]) layout and add
 * `${cairo.variable} ${tajawal.variable}` to the <html> className so the
 * Tailwind `font-sans` token (var(--font-cairo)) resolves.
 */
export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});
