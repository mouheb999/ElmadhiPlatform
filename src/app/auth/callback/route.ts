import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * OAuth callback. Supabase redirects here with a `code` we exchange for a
 * session cookie, then forward the user on to `next` (default /dashboard).
 *
 * `next` is narrowed to a same-origin path first. Pasted straight into
 * `${origin}${next}` it was an open redirect: "@evil.com" yields
 * "https://oursite.com@evil.com", which browsers resolve to host evil.com with
 * oursite.com as userinfo — a convincing phishing hop out of a real sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
