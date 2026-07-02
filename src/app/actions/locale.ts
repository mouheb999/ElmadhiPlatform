"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the chosen UI language in a cookie. Server components read it via
 * `getLocale()`, so revalidating the root layout re-renders the whole app in
 * the new language (and flips `dir` for RTL/LTR).
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
