/**
 * Narrowing for `?next=` values before they are used as a redirect target.
 *
 * Both sign-in paths carry the user's intended destination in a query
 * parameter: `proxy.ts` sets `?next=` when it bounces a signed-out user to
 * /login, and the OAuth callback forwards it after exchanging the code. A query
 * parameter is attacker-controlled, so neither may be handed to `redirect()` or
 * `router.push()` as-is.
 *
 * The dangerous shapes are the ones that still *look* like a path:
 *
 *   "https://evil.com"  — absolute; router.push() leaves the site
 *   "//evil.com"        — protocol-relative; the browser reads evil.com as host
 *   "/\evil.com"        — some browsers normalise the backslash to "/"
 *   "@evil.com"         — concatenated onto an origin it becomes
 *                         "https://site.com@evil.com", where site.com is
 *                         userinfo and the real host is evil.com
 *
 * Requiring a single leading "/" rejects all of them, and it is the whole rule:
 * anything that survives is a same-origin path by construction. Rejected input
 * is not an error the user needs to see — they just land on the default.
 *
 * Client-safe, zero deps.
 */

const DEFAULT_DESTINATION = "/dashboard";

export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_DESTINATION,
): string {
  if (!value) return fallback;
  // Must be rooted: rejects "https://…", "@evil.com", and bare words.
  if (!value.startsWith("/")) return fallback;
  // Must not be protocol-relative, in either slash direction.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
