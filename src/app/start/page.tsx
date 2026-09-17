import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FUNNEL_COOKIE, parseFunnelAnswers } from "@/lib/funnel/answers";
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

  return <StartClient locale={locale} initialAnswers={initialAnswers} />;
}
