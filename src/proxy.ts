import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  GATE_COOKIE,
  GATE_COOKIE_OPTIONS,
  issueGateTicket,
  verifyGateTicket,
} from "@/lib/paywall-gate";

// Routes that require a signed-in, paid user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/diet",
  "/workout",
  "/ai",
  "/qa",
  "/review",
  "/progress",
  "/settings",
];

// Deliberately absent from PROTECTED_PREFIXES above: /support. It is matched
// (so the session still refreshes there) but not paywalled — "I paid and I'm
// still locked out" is precisely the report that must be able to reach an
// admin. The (app) layout still requires a signed-in user, and RLS still
// scopes every ticket to its owner.

// Renamed from `middleware` per Next.js 16 deprecation (middleware -> proxy).
export async function proxy(request: NextRequest) {
  const { response, supabase, user, indeterminate } =
    await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) return response;

  // Supabase was unreachable, not "this user is signed out". Bouncing them to
  // /login over a network blip would throw away the page they were on (and, on
  // a server-action POST, the input they just typed). Let the request through:
  // the route's own auth check and RLS are still in force, so nothing leaks.
  if (indeterminate) return response;

  // Must be signed in.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Gate: only accounts an admin has activated can reach the app. Everyone
  // else is held on /checkout until their payment is confirmed. Admins always
  // pass (so they can use the app while reviewing requests). An active
  // subscription whose term has ended counts as expired → back to /checkout
  // to renew.
  //
  // A recent pass is carried in a signed, user-bound cookie so this doesn't
  // cost a database round-trip on literally every tap. See lib/paywall-gate.
  if (await verifyGateTicket(request.cookies.get(GATE_COOKIE)?.value, user.id)) {
    return response;
  }

  let profile: {
    payment_status: string | null;
    is_admin: boolean | null;
    plan_expires_at: string | null;
  } | null = null;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("payment_status, is_admin, plan_expires_at")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch (err) {
    // Same reasoning as `indeterminate` above: a database hiccup must not
    // become a 500 or an eviction to /checkout for a paying user.
    console.error("[proxy] payment gate lookup failed:", err);
    return response;
  }

  const expired =
    !!profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date();

  if (!profile?.is_admin && (profile?.payment_status !== "active" || expired)) {
    const url = request.nextUrl.clone();
    url.pathname = "/checkout";
    const redirectResponse = NextResponse.redirect(url);
    // Never leave a stale pass behind on a user who just lost access.
    redirectResponse.cookies.delete(GATE_COOKIE);
    return redirectResponse;
  }

  const ticket = await issueGateTicket(user.id);
  if (ticket) response.cookies.set(GATE_COOKIE, ticket, GATE_COOKIE_OPTIONS);
  return response;
}

export const config = {
  // Only the routes that actually need a session refresh or a gate. Everything
  // else — static assets, the image optimizer, icons, the manifest, the payment
  // webhook, /auth/callback (which sets its own cookies), the marketing page —
  // used to pay for an auth round-trip it had no use for.
  matcher: [
    "/dashboard/:path*",
    "/diet/:path*",
    "/workout/:path*",
    "/ai/:path*",
    "/qa/:path*",
    "/review/:path*",
    "/progress/:path*",
    "/settings/:path*",
    "/support/:path*",
    "/admin/:path*",
    "/checkout/:path*",
  ],
};
