import { cache } from "react";
import { headers } from "next/headers";
import { isAppShellUserAgent } from "@/lib/access";

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
 * Reading a header opts a route into dynamic rendering. Every `(app)` route is
 * already `force-dynamic` and `/login` already reads `searchParams`, so nothing
 * that calls this was statically rendered to begin with.
 */
export const isAppShell = cache(async (): Promise<boolean> => {
  const store = await headers();
  return isAppShellUserAgent(store.get("user-agent"));
});
