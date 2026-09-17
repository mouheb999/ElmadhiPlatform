import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { StartClient } from "./start-client";

/**
 * The landing screen for paid traffic.
 *
 * Point every ad here — `https://…/start?utm_source=meta&utm_campaign=…`. The
 * query string is read in the browser and kept in a cookie, then attached to
 * the account at sign-up, so a subscriber can be traced back to the creative
 * that produced them. See lib/funnel/attribution.ts.
 *
 * Deliberately outside the proxy's matcher: this page has no session to
 * refresh and nothing to gate, and an ad click should not wait on an auth
 * round-trip before it renders. It is also deliberately not `force-dynamic` —
 * everything about it is the same for every visitor, and the one
 * visitor-specific thing (their half-finished answers) is read client-side.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, "fn.title"),
    description: t(locale, "fn.meta_desc"),
  };
}

export default async function StartPage() {
  const locale = await getLocale();
  return <StartClient locale={locale} />;
}
