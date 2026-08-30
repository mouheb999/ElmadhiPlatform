import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * The signed-in user for the current request, or null.
 *
 * Why this exists instead of calling `supabase.auth.getUser()` directly:
 *
 * 1. `getUser()` is an HTTP round-trip to Supabase's auth server on EVERY call.
 *    A single dashboard render used to make three of them (proxy + layout +
 *    page) before a byte of data was fetched. `getClaims()` verifies the access
 *    token's signature locally with WebCrypto — this project signs with ES256
 *    and publishes its JWKS, and auth-js caches that key set process-wide for
 *    10 minutes, so the common path costs no network at all. When the token is
 *    symmetric-signed or WebCrypto is missing, `getClaims()` transparently falls
 *    back to a `getUser()` call, so security is never weaker than before.
 *
 * 2. `cache()` dedupes it per request. A layout and its page asking for the user
 *    now share one verification instead of doing the work twice.
 *
 * A near-expiry token is still refreshed by `getClaims()` (via `getSession()`),
 * so sessions keep rolling exactly as they did.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});
