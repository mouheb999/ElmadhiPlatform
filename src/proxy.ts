import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  GATE_COOKIE,
  GATE_COOKIE_OPTIONS,
  issueGateTicket,
  verifyGateTicket,
} from "@/lib/paywall-gate";
import { isSubscriptionActive } from "@/lib/subscription";
import {
  APP_SHELL_COOKIE,
  APP_SHELL_COOKIE_OPTIONS,
  APP_SHELL_QUERY,
  featureForPath,
  isAppShellSignal,
  isBlockedInApp,
  isPaidPath,
} from "@/lib/access";

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
//
// The Android app — a Trusted Web Activity, so real Chrome with a cookie
// rather than a WebView with its own user agent — is the one caller that does
// not follow the paragraph above.
// It cannot: /checkout is where an unpaid web user is sent, and /checkout is
// the single screen Google Play will not let the app contain. So requests
// carrying the shell's user agent are routed on the reverse-trial surface
// instead — plan readable, recording and tracking behind a card that asks for
// access rather than for money — and the marketing routes are closed to them
// outright. Everything below is shared; `appShell` only ever changes which
// destination a redirect picks, never who may read what.

// Renamed from `middleware` per Next.js 16 deprecation (middleware -> proxy).
export async function proxy(request: NextRequest) {
  const { response, supabase, user, indeterminate } =
    await updateSession(request);
  const { pathname } = request.nextUrl;

  /**
   * The shell announcing itself: `/login?app=1`, its start URL.
   *
   * Answered with a redirect carrying the cookie, and the redirect is the
   * point rather than a tidying-up: a cookie set on a response is not on the
   * *request* that set it, so without the extra hop the very first render
   * after launch would still look like the web to `isAppShell()`. One 307 at
   * cold start buys "every render sees the cookie", which is a far easier rule
   * to hold than "every render after the first". It also keeps the flag out of
   * the address bar and out of history.
   *
   * Where it lands depends on who is holding the phone, because the start URL
   * cannot know. /login is the right destination exactly once — the first
   * launch after install. Every launch after that is by somebody already
   * signed in, and sending them to a sign-in form they have no business
   * filling in is the single most confusing thing a cold start could do. So a
   * signed-in launch goes to /dashboard, where the gate below then applies
   * normally: active accounts get the app, unpaid ones get the free surface,
   * since /dashboard is not a paid path in app mode.
   *
   * `indeterminate` — Supabase unreachable rather than signed out — goes to
   * /dashboard too. The (app) layout redirects to /login itself if there is
   * genuinely nobody there, so the worst case is one extra hop, whereas
   * treating a network blip as a sign-out would show a signed-in user a login
   * form on every cold start with bad reception.
   *
   * This now runs after `updateSession` rather than before it. It used to go
   * first, to avoid paying for a session refresh the redirect would discard —
   * but the verdict it discarded is precisely the one needed to choose a
   * destination, so the refresh is no longer wasted.
   *
   * No loop is possible: the flag is deleted on the way out.
   */
  if (request.nextUrl.searchParams.get(APP_SHELL_QUERY) === "1") {
    const url = request.nextUrl.clone();
    url.searchParams.delete(APP_SHELL_QUERY);
    if (url.pathname === "/login" && (user || indeterminate)) {
      url.pathname = "/dashboard";
    }
    const marked = NextResponse.redirect(url);
    marked.cookies.set(APP_SHELL_COOKIE, "1", APP_SHELL_COOKIE_OPTIONS);
    return marked;
  }

  // Is this the Android app rather than a browser? The cookie above is the
  // real signal; the user agent is the Capacitor-era fallback. See lib/access
  // for why this is a routing hint and not a security boundary.
  const appShell = isAppShellSignal({
    cookie: request.cookies.get(APP_SHELL_COOKIE)?.value,
    userAgent: request.headers.get("user-agent"),
  });

  // The app shows neither the marketing site nor the till.
  //
  // This runs before the subscription gate below, and it has to. /checkout sits
  // in that gate's always-free list and is where it sends anybody unpaid — so
  // left to fall through, an unpaid app user would be pushed to /checkout by
  // the paywall and pulled back out of it by this block, forever. Ordering is
  // what makes it a policy instead of a loop.
  if (appShell && isBlockedInApp(pathname)) {
    const url = request.nextUrl.clone();
    url.search = "";
    // `indeterminate` means Supabase was unreachable, not that this user is
    // signed out (see updateSession) — bouncing them to /login over a network
    // blip would sign them out of the app for no reason. /dashboard is the safe
    // destination in both cases: if there is genuinely nobody signed in, the
    // (app) layout redirects to /login on its own.
    url.pathname = user || indeterminate ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  const isPaid = isPaidPath(pathname, { appShell });
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

  // Must be signed in — except at the till.
  //
  // /checkout is the sales page. Everything that argues for the product lives
  // there: the walkable preview of the app, the plans, the prices. Requiring an
  // account to see any of it meant a stranger from the landing site had to hand
  // over a name, a number, an address and a password before being shown a
  // single screen of what they were buying — the same mistake as asking for
  // money before showing the product, one step earlier.
  //
  // So the pitch is public and the account is asked for at the last moment
  // before money: choosing a plan. Not after, deliberately. Payment here is a
  // bank transfer confirmed by hand hours later, so the person will close the
  // app and come back; an anonymous purchase that dies with the session is a
  // customer who paid and cannot prove it. The screen behind the account —
  // where the RIB and the receipt live — still requires one.
  if (!user) {
    if (isCheckout) return response;
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
    url.search = "";
    // What they reached for, so the destination can name it. Same vocabulary
    // the in-app upgrade cards use, not the raw path.
    const feature = featureForPath(pathname);
    if (appShell) {
      // There is no /checkout in the app, so an unpaid tap goes home carrying
      // what it was reaching for. A different parameter name than the web's
      // `from=` on purpose: they address different readers. `from` opens a
      // sales page about that feature; `locked` is a request for access, and
      // the screen it drives points at /support rather than at a price.
      //
      // Nothing reads `locked` yet. That is deliberate for this step — an
      // unrecognised query parameter renders the dashboard exactly as it does
      // today, so this redirect is already correct and already loop-free
      // before the free-mode screens exist to interpret it.
      url.pathname = "/dashboard";
      if (feature) url.searchParams.set("locked", feature);
    } else {
      url.pathname = "/checkout";
      if (feature) url.searchParams.set("from", feature);
    }
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

    // The marketing surface, matched *only* when the request came from the app.
    //
    // A plain "/" and "/start" in this list would work, and would also undo the
    // reason they were left out: these are the pages paid ads point at, and
    // every click would start paying for an auth round-trip it has no use for
    // (see the note at the top of start/page.tsx). `has` keeps that true for
    // browsers — a web visitor never enters the proxy here at all — while the
    // app, which needs the redirect, is the only caller that does.
    //
    // Two entries per path rather than one, because `has` is an AND of its
    // conditions while separate entries are an OR, and the app can identify
    // itself either way: by cookie (the TWA) or by user agent (the Capacitor
    // fallback). A cookie condition with no `value` matches on presence alone.
    //
    // All of it is spelled out literally rather than built from the constants
    // in lib/access, because matcher values must be statically analysable at
    // build time — a variable here is not an error, it is silently ignored,
    // which would quietly serve the marketing page inside the app. The user
    // agent pattern is additionally anchored at both ends by Next (`new
    // RegExp("^" + value + "$")`), hence the surrounding `.*` around a string
    // that has a browser's worth of tokens either side of it.
    { source: "/", has: [{ type: "cookie", key: "elmadhi_app" }] },
    {
      source: "/",
      has: [
        { type: "header", key: "user-agent", value: ".*HypeFitnessApp.*" },
      ],
    },
    { source: "/start/:path*", has: [{ type: "cookie", key: "elmadhi_app" }] },
    {
      source: "/start/:path*",
      has: [
        { type: "header", key: "user-agent", value: ".*HypeFitnessApp.*" },
      ],
    },

    // The shell's start URL. /login is otherwise deliberately outside the
    // matcher — it has no session to refresh and nothing to gate — and it only
    // needs to be here for the one request that carries `?app=1`, so that the
    // flag can be exchanged for the cookie.
    { source: "/login", has: [{ type: "query", key: "app", value: "1" }] },
  ],
};
