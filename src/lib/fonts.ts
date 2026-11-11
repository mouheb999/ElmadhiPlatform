import { Cairo, Inter, Saira, Tajawal } from "next/font/google";

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
/**
 * The UI face in English: body copy, headings, buttons, labels.
 *
 * The redesign moved headings off Saira. A squared-off display face on every
 * title and button is a large part of why the old screens read as a template
 * — it is a voice for a logo, not for an interface people read all day.
 * Inter is the closest freely licensed match to the system UI faces native
 * apps use, which is the look the redesign is going for.
 *
 * Arabic never uses it: globals.css points --font-ui at Cairo under
 * lang="ar", keeping the Arabic UI on one typeface.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Saira survives where it earns its place: the wordmark and big numbers —
 * calories left, weight, sets — where its wide, flat-terminal figures carry
 * the brand's sporty voice. Reached through `font-num`, never as body text.
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
