import { isStringKey, t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * `t()` for a key that only exists as a string at runtime.
 *
 * The gates in `lib/clinical` return reason keys as plain strings — they are
 * pure, client-safe logic and have no business importing the copy catalogue.
 * This is the one place that bridges the two, and it fails visibly rather than
 * silently: an unknown key renders as itself, so a typo shows up on the screen
 * during development instead of rendering as an empty space in production.
 */
export function careText(locale: Locale, key: string): string {
  return isStringKey(key) ? t(locale, key as StringKey) : key;
}
