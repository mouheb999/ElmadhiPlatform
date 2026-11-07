import { cache } from "react";
import { cookies, headers } from "next/headers";
import { APP_SHELL_COOKIE, isAppShellSignal } from "@/lib/access";

/**
 * Server-side "is this the Android app?", for Server Components and Server
 * Functions.
 *
 * Kept out of `access.ts` for the same reason `i18n-server.ts` is kept out of
 * `i18n.ts`: that module is imported by `proxy.ts`, which runs in its own
 * bundle, and by client components that grey out a locked control. Neither can
 * pull in `next/headers`. The predicate itself lives there and is shared; only
 * the request plumbing is here.
 *
 * `cache()` dedupes it per request, so a layout, the page inside it and an
 * action it calls all read the one header without repeating the work.
 *
 * Reading a header or a cookie opts a route into dynamic rendering. Every
 * `(app)` route is already `force-dynamic` and `/login` already reads
 * `searchParams`, so nothing that calls this was statically rendered to begin
 * with.
 *
 * The cookie is the real signal and the user agent is the fallback — see
 * `isAppShellSignal`. This never has to cope with the launch request that has
 * `?app=1` but no cookie yet: the proxy answers that one with a redirect to the
 * clean URL, so by the time any page renders, the cookie is on the request.
 */
export const isAppShell = cache(async (): Promise<boolean> => {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  return isAppShellSignal({
    cookie: cookieStore.get(APP_SHELL_COOKIE)?.value,
    userAgent: headerStore.get("user-agent"),
  });
});
