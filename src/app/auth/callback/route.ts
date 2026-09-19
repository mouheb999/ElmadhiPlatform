import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/safe-redirect";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/lib/funnel/attribution";
import { FUNNEL_COOKIE, parseFunnelAnswers } from "@/lib/funnel/answers";
import { readClientContext, sendMetaEvent } from "@/lib/meta/capi";
import { REGISTRATION_EVENT_COOKIE } from "@/lib/meta/pixel";

/**
 * An account this young, arriving through the callback, was just created by
 * this sign-in. Generous on purpose: the event id is derived from the user id,
 * so a returning sign-in inside the window is deduplicated by Meta rather than
 * counted twice.
 */
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await carryFunnelToProfile(request, data.user?.id);
      const response = NextResponse.redirect(`${origin}${next}`);

      // A Google sign-up: CompleteRegistration from here, and the same event
      // id handed to the browser in a short-lived cookie so the pixel on the
      // next page can send its half. See `MetaPixel`.
      const user = data.user;
      const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
      if (user && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS) {
        const eventId = `reg_${user.id}`;
        const client = await readClientContext();
        after(() =>
          sendMetaEvent({
            name: "CompleteRegistration",
            eventId,
            path: "/login",
            user: { id: user.id, email: user.email, ...client },
          }),
        );
        response.cookies.set(REGISTRATION_EVENT_COOKIE, eventId, {
          path: "/",
          maxAge: 60,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/**
 * The Google half of "which ad produced this customer".
 *
 * Email sign-up carries the funnel cookies into `auth.users.raw_user_meta_data`
 * and the trigger in migration 054 copies them onto the profile. Google sign-up
 * has no such moment: Supabase writes the metadata Google supplies and nothing
 * else, so an account created here would arrive with no attribution at all —
 * and if a meaningful share of sign-ups come through this route, every campaign
 * report is quietly wrong by that share.
 *
 * So the same two cookies are read off this request and written here instead.
 *
 * Three constraints shaped it:
 *
 *   - **Only ever fills a blank.** The `is null` guards mean a returning user
 *     signing in for the twentieth time cannot overwrite the campaign that
 *     originally produced them with whatever is in their cookie jar today.
 *   - **Service role, not the user's session.** `attribution` is deliberately
 *     absent from the column whitelist in migration 039, so a user session
 *     cannot write it — which is the point: it is a record about them, not a
 *     field of theirs.
 *   - **Never blocks the redirect.** A failure here costs a row of marketing
 *     data. Failing the sign-in over it would cost the customer.
 */
async function carryFunnelToProfile(request: NextRequest, userId: string | undefined) {
  if (!userId) return;

  const attribution = parseAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
  const answers = parseFunnelAnswers(request.cookies.get(FUNNEL_COOKIE)?.value);
  const hasAnswers = Object.keys(answers).length > 0;
  if (!attribution && !hasAnswers) return;

  try {
    const admin = createAdminClient();
    if (attribution) {
      await admin
        .from("profiles")
        .update({ attribution })
        .eq("id", userId)
        .is("attribution", null);
    }
    if (hasAnswers) {
      await admin
        .from("profiles")
        .update({ funnel_answers: answers })
        .eq("id", userId)
        .is("funnel_answers", null);
    }
  } catch (err) {
    console.error("[auth/callback] could not record attribution:", err);
  }
}
