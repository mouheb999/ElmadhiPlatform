import { cookies } from "next/headers";
import {
  type Locale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
} from "@/lib/i18n";

/**
 * Server-only locale helpers. Kept separate from `i18n.ts` so client components
 * can import the client-safe parts (t, dir, pick) without pulling in
 * `next/headers`.
 */

/** Read the active locale from the cookie (server-side), defaulting to tn. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
