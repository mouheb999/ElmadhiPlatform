import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/db";

/** Never let a stalled Supabase call hold a page request open indefinitely. */
const AUTH_TIMEOUT_MS = 4000;

export type SessionUser = { id: string; email: string | null };

export type UpdateSessionResult = {
  response: NextResponse;
  supabase: ReturnType<typeof createServerClient<Database>>;
  user: SessionUser | null;
  /**
   * True when we could not reach a verdict — network blip, timeout, JWKS fetch
   * failure. Distinct from `user: null`, which means "definitely signed out".
   * Callers must not treat this as a sign-out.
   */
  indeterminate: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("auth-timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Refreshes the Supabase session on matched requests and returns both the
 * (possibly cookie-mutated) response and the verified user.
 *
 * Verification uses `getClaims()`, which checks the access token's ES256
 * signature locally with WebCrypto against the project's JWKS (cached
 * process-wide for 10 minutes) instead of paying an HTTP round-trip to the auth
 * server on every single request. It still refreshes tokens that are near
 * expiry, and it transparently falls back to a server-side `getUser()` call
 * whenever the token isn't asymmetrically signed — so this is never less strict
 * than before, just far fewer network hops.
 *
 * Any failure to reach a verdict is reported as `indeterminate` rather than
 * thrown. Throwing here turned a momentary Supabase hiccup into a 500 for the
 * whole request — including server-action POSTs, which surfaces on iOS as the
 * browser's "This page couldn't load" screen with the user's input lost.
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const { data, error } = await withTimeout(
      supabase.auth.getClaims(),
      AUTH_TIMEOUT_MS,
    );

    // A real auth error (missing/expired/tampered token) is a definitive
    // "signed out". Only infrastructure failures are indeterminate, and those
    // arrive as thrown exceptions below.
    if (error || !data?.claims?.sub) {
      return { response, supabase, user: null, indeterminate: false };
    }

    return {
      response,
      supabase,
      user: {
        id: data.claims.sub,
        email: typeof data.claims.email === "string" ? data.claims.email : null,
      },
      indeterminate: false,
    };
  } catch (err) {
    console.error("[proxy] auth check failed:", err);
    return { response, supabase, user: null, indeterminate: true };
  }
}
