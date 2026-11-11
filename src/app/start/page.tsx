import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FUNNEL_COOKIE, parseFunnelAnswers } from "@/lib/funnel/answers";
import { createClient } from "@/lib/supabase/server";
import { StartClient } from "./start-client";

/**
 * The landing screen for paid traffic.
 *
 * Point every ad here — `https://…/start?utm_source=meta&utm_campaign=…`. The
 * query string is read in the browser and kept in a cookie, then attached to
 * the account at sign-up, so a subscriber can be traced back to the creative
 * that produced them. See lib/funnel/attribution.ts.
 *
 * There is no welcome screen. The ad is the pitch, the landing page is the
 * pitch, and a third "here is what you are about to do" screen with one button
 * on it is a tap between a click we paid for and the thing it was sold on. The
 * first question is the first thing the visitor sees.
 *
 * Deliberately outside the proxy's matcher: this page has no session to
 * refresh and nothing to gate, and an ad click should not wait on an auth
 * round-trip before it renders.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, "fn.title"),
    description: t(locale, "fn.meta_desc"),
  };
}

export default async function StartPage() {
  const store = await cookies();
  const locale = await getLocale();

  /**
   * Half-finished answers from a previous visit, read here rather than in the
   * browser.
   *
   * With no welcome screen there is no longer a click to hang the cookie read
   * on: the questionnaire is on screen immediately, so it has to know at the
   * first paint which question to open on and which cards are already lit.
   * Reading it client-side would mean rendering question one, then replacing it
   * with question seven — a visible jump, and a hydration mismatch besides.
   * This page already reads a cookie for the locale, so it costs nothing new.
   */
  const initialAnswers = parseFunnelAnswers(store.get(FUNNEL_COOKIE)?.value);

  /**
   * The lowest monthly price on sale, for the line under the reveal's button.
   *
   * Read from the plans rather than written into the copy, because prices have
   * changed three times and a number in a translation file is the one that
   * gets forgotten. Plans are public-read (migration 017), so this works with
   * no session. A failure is not worth failing the page over: the line simply
   * is not shown.
   */
  let fromPerMonth: number | null = null;
  try {
    const supabase = await createClient();
    const { data: plans } = await supabase
      .from("subscription_plans")
      .select("months, price_tnd")
      .eq("is_enabled", true);
    const perMonth = (plans ?? [])
      .filter((p) => p.months > 0 && p.price_tnd > 0)
      .map((p) => p.price_tnd / p.months);
    if (perMonth.length) fromPerMonth = Math.round(Math.min(...perMonth) * 10) / 10;
  } catch {
    fromPerMonth = null;
  }

  return (
    <StartClient locale={locale} initialAnswers={initialAnswers} fromPerMonth={fromPerMonth} />
  );
}
