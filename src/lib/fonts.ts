import { Cairo, Saira, Tajawal } from "next/font/google";

/**
 * HYPE FITNESS brand fonts. Import these in your root (or [locale]) layout and add
 * `${cairo.variable} ${saira.variable} ${tajawal.variable}` to the <html> className
 * so the Tailwind `font-sans` (var(--font-cairo)) and `font-display`
 * (var(--font-saira)) tokens resolve.
 */

/**
 * Display face for headings, buttons and nav labels — a squared-off industrial
 * grotesque whose flat terminals and wide stance match the logo's lettering, which
 * Cairo's softer humanist Latin does not.
 *
 * English only. globals.css points `--font-brand` back at Cairo under `lang="ar"`,
 * so the Arabic UI keeps one typeface throughout rather than mixing faces wherever
 * a Latin word appears mid-sentence.
 */
export const saira = Saira({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira",
  display: "swap",
});
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
