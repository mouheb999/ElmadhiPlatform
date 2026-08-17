import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  GATE_COOKIE,
  GATE_COOKIE_OPTIONS,
  issueGateTicket,
  verifyGateTicket,
} from "@/lib/paywall-gate";
import { isSubscriptionActive } from "@/lib/subscription";
import { featureForPath, isPaidPath } from "@/lib/access";

// Which routes cost money lives in lib/access, because the client components
// that grey out a locked control need the same answer.
//
// `REVERSE_TRIAL` there is currently OFF, so that is every route but the
// handful in ALWAYS_FREE_PREFIXES: a new signup is redirected to /checkout
// before it sees a questionnaire, a program or a dashboard. Nothing in this
// file encodes that choice — flipping the flag moves this gate with it.
//
// Deliberately never paywalled, in either mode: /support ("I paid and I'm still
// locked out" is precisely the report that must reach an admin), /checkout and
// /phone (gating them is a redirect loop), and /settings (it holds the only
// sign-out button, so gating it strands a locked-out account in its own
// session). The (app) layout still requires a signed-in user, and RLS still
// scopes every row to its owner.

// Renamed from `middleware` per Next.js 16 deprecation (middleware -> proxy).
export async function proxy(request: NextRequest) {
  const { response, supabase, user, indeterminate } =
    await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPaid = isPaidPath(pathname);
  const isCheckout =
    pathname === "/checkout" || pathname.startsWith("/checkout/");

  // Everything else in the matcher is here for the session refresh only. The
  // free surface — dashboard, questionnaires, program, diet plan, settings —
  // falls out here and is never gated.
  if (!isPaid && !isCheckout) return response;

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

  // Gate: only accounts an admin has activated can record anything. Everyone
  // else is sent to /checkout. Admins always pass (so they can use the app
  // while reviewing requests). An active subscription whose term has ended
  // counts as expired → back to /checkout to renew.
  //
  // A recent pass is carried in a signed, user-bound cookie so this doesn't
  // cost a database round-trip on literally every tap. See lib/paywall-gate.
  //
  // Checkout skips the fast path deliberately: it needs the profile read below
  // regardless, to know whether a contact number is on file.
  if (
    isPaid &&
    (await verifyGateTicket(request.cookies.get(GATE_COOKIE)?.value, user.id))
  ) {
    return response;
  }

  let profile: {
    payment_status: string | null;
    is_admin: boolean | null;
    plan_expires_at: string | null;
    phone: string | null;
  } | null = null;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("payment_status, is_admin, plan_expires_at, phone")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch (err) {
    // Same reasoning as `indeterminate` above: a database hiccup must not
    // become a 500 or an eviction to /checkout for a paying user.
    console.error("[proxy] payment gate lookup failed:", err);
    return response;
  }

  // No contact number yet → collect one, but only at the till.
  //
  // This used to fire on the first visit to /dashboard, so a brand new account
  // was asked for a phone number before it had seen anything at all — the first
  // of the two demands that made the old funnel fail. The reason for asking has
  // not changed (someone who stalls mid-payment is exactly the person worth
  // being able to reach) but that reason only applies once they are actually
  // paying, so it now runs on /checkout alone.
  //
  // Deliberately not on the paid routes either: somebody who taps Progress on a
  // free account should be told that Progress is part of the plan, not handed a
  // phone form for a product they have not agreed to buy. They fall through to
  // the /checkout redirect below and meet this on the next hop.
  //
  // Admins are exempt — locking the person who confirms payments out of the
  // admin panel over a missing phone number would be self-defeating.
  if (isCheckout) {
    if (!profile?.is_admin && !profile?.phone?.trim()) {
      const url = request.nextUrl.clone();
      url.pathname = "/phone";
      url.search = "";
      url.searchParams.set("next", "/checkout");
      return NextResponse.redirect(url);
    }
    // Checkout is never paywalled — that would be a redirect loop, and a lapsed
    // customer has to be able to reach it to renew.
    return response;
  }

  // Same predicate the paid Server Functions enforce, so the optimistic gate
  // and the real boundary can never disagree about who is paid up.
  if (!isSubscriptionActive(profile)) {
    const url = request.nextUrl.clone();
    url.pathname = "/checkout";
    url.search = "";
    // What they reached for, so checkout opens by naming it. Same vocabulary
    // the in-app upgrade cards use, not the raw path.
    const feature = featureForPath(pathname);
    if (feature) url.searchParams.set("from", feature);
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
    // Matched for the session refresh only — it is absent from
    // PROTECTED_PREFIXES, so the gate never runs here and the redirect to it
    // cannot loop.
    "/phone/:path*",
  ],
};
