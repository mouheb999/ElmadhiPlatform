"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { GATE_COOKIE } from "@/lib/paywall-gate";
import {
  contactEmail,
  normalizePhone,
  parseLoginIdentifier,
  phoneLoginEmail,
} from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site-url";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/lib/funnel/attribution";
import { FUNNEL_COOKIE, parseFunnelAnswers } from "@/lib/funnel/answers";
import { getPostHogClient } from "@/lib/posthog-server";
import { readClientContext, sendMetaEvent } from "@/lib/meta/capi";

/**
 * The origin confirmation and OAuth links come back to.
 *
 * Resolution — and the reasons behind its order — lives in `lib/site-url.ts`.
 * The Host header appears only below, and only outside production: it is set by
 * the caller, so a request with `Host: attacker.example` would mint a sign-up
 * confirmation link pointing there, and following that link hands the token in
 * it to whoever owns that host. Locally there is no attacker and no email, and
 * it saves needing any config to run the app.
 */
async function siteUrl(): Promise<string | null> {
  const resolved = siteOrigin();
  if (resolved) return resolved;

  if (process.env.NODE_ENV === "production") {
    // Nothing configured and no platform hostname to fall back on. Refuse
    // rather than guess; callers turn this into a plain error message.
    console.error("[auth] No site origin: set SITE_URL to this deployment's public URL.");
    return null;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const MISCONFIGURED = "Sign-in is misconfigured. Please contact support.";

/**
 * What the visitor brought with them from before they had an account.
 *
 * Two cookies, both written in the browser during the funnel:
 *
 *   - the ad click that produced them, which is the only way a campaign can be
 *     judged on subscribers rather than on clicks;
 *   - the answers they gave on /start, so the questionnaire opens pre-filled
 *     and an admin chasing a stalled payment can see who they are talking to.
 *
 * Both are re-parsed rather than forwarded: they are user-writable, so what
 * reaches the database is the validated subset this code understands and not
 * whatever was in the cookie. They ride along as sign-up metadata because the
 * trigger in migration 054 copies them onto the profile row at creation — the
 * one moment they are true, and the only write that does not need the user to
 * hold an UPDATE grant on those columns.
 *
 * Failure here is silent on purpose. A malformed cookie must never be the
 * reason somebody cannot create an account.
 */
async function funnelMetadata(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const metadata: Record<string, string> = {};

    const attribution = parseAttribution(store.get(ATTRIBUTION_COOKIE)?.value);
    if (attribution) metadata.attribution = JSON.stringify(attribution);

    const answers = parseFunnelAnswers(store.get(FUNNEL_COOKIE)?.value);
    if (Object.keys(answers).length) metadata.funnel_answers = JSON.stringify(answers);

    return metadata;
  } catch {
    return {};
  }
}

/**
 * Turn whatever the auth server said into something a customer can act on.
 *
 * These messages went to the screen verbatim, and most of them were never
 * written for a customer to read. Driving a sign-up while Supabase was
 * unreachable put this in front of the user, in a right-to-left Arabic form,
 * under the password field:
 *
 *     Unexpected token 'H', "Host not i"... is not valid JSON
 *
 * That is auth-js reporting that an error page came back where JSON was
 * expected — any outage, gateway or WAF between the app and Supabase produces
 * one. Launch day is exactly when that happens, and the person seeing it is
 * someone trying to hand us money.
 *
 * So: a small set of stable codes the form localises itself, because the
 * message from Supabase is English regardless of which language the user is
 * reading. Anything without a `code` is not an answer from the auth API at all
 * — it is a network or parse failure — and becomes "try again", never the raw
 * text.
 */
function authFailure(error: { code?: string; message?: string }): string {
  const code = typeof error.code === "string" ? error.code : "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "auth_bad_credentials";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "auth_email_taken";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return "auth_weak_password";
  }
  if (code === "email_not_confirmed") return "auth_email_unconfirmed";
  if (code.startsWith("over_") || message.includes("rate limit")) {
    return "auth_rate_limited";
  }
  // No code means auth-js could not read a reply from the auth API: offline,
  // a proxy, an outage, a captive portal. Never surfaced verbatim.
  if (!code) {
    console.error("[auth] unexpected auth failure:", error.message);
    return "auth_unavailable";
  }
  console.error("[auth] unhandled auth error:", code, error.message);
  return "auth_unavailable";
}

/**
 * Which accounts a typed phone number could be signing in to.
 *
 * A phone-only account lives under the address derived from its number, so
 * that is tried first. But some eight hundred accounts were created before
 * phone-only sign-up existed, with a real email *and* a number on file, and
 * their owners will reasonably type the number into a field that says "phone
 * number". Those are found by the number and tried next.
 *
 * The lookup needs the service role (a signed-out caller cannot read
 * `profiles`), and it never leaves this function: the caller is told only
 * whether the password matched, exactly as for an email — so this cannot be
 * used to learn which address a number belongs to.
 */
async function emailsForPhone(phone: string): Promise<string[]> {
  const derived = phoneLoginEmail(phone);
  const emails = derived ? [derived] : [];
  try {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(3);
    for (const row of data ?? []) {
      if (row.email && !emails.includes(row.email)) emails.push(row.email);
    }
  } catch (err) {
    // No service role key (local development) or the lookup failed. The
    // derived address still works for every phone-only account.
    console.error("[auth] phone lookup unavailable:", err);
  }
  return emails;
}

/** True when a profile already carries this number. Fails open. */
async function phoneAlreadyRegistered(phone: string): Promise<boolean> {
  try {
    const { count } = await createAdminClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone);
    return (count ?? 0) > 0;
  } catch (err) {
    console.error("[auth] phone uniqueness check unavailable:", err);
    return false;
  }
}

/**
 * Sign in with whatever the customer typed: an email, or a phone number.
 */
export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<ActionResult<{ isAdmin: boolean; userId: string }>> {
  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) return fail("auth_bad_credentials");

  const candidates =
    parsed.kind === "email" ? [parsed.email] : await emailsForPhone(parsed.phone);

  const supabase = await createClient();
  let signedIn: { id: string } | null = null;
  let lastError: { code?: string; message?: string } | null = null;
  for (const email of candidates) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      signedIn = data.user;
      break;
    }
    lastError = error;
    // Only a wrong password is worth trying the next address for. A rate
    // limit or an outage will be the same answer every time.
    if (error && authFailure(error) !== "auth_bad_credentials") break;
  }
  if (!signedIn) return fail(lastError ? authFailure(lastError) : "auth_bad_credentials");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", signedIn.id)
    .maybeSingle();

  // Track sign-in server-side so both client and server streams share the event.
  const posthog = getPostHogClient();
  if (posthog) {
    posthog.identify({
      distinctId: signedIn.id,
      properties: { is_admin: !!profile?.is_admin },
    });
    posthog.capture({
      distinctId: signedIn.id,
      event: "user_signed_in",
      properties: { method: parsed.kind },
    });
    await posthog.flush();
  }

  return ok({ isAdmin: !!profile?.is_admin, userId: signedIn.id });
}

/**
 * Sign up with a phone number and a password, and report whether that already
 * signed the user in.
 *
 * An email is optional and nobody is asked for one any more — see
 * `phoneLoginEmail` in lib/phone.ts for where the account is filed instead and
 * why. A name is not collected at all: the product greets people without one,
 * and it was a quarter of a form three quarters of people abandoned.
 *
 * Supabase is configured with `mailer_autoconfirm` on, so `signUp` returns a
 * session and no confirmation mail is ever sent. That is a dashboard setting,
 * not a fact about this code, so the answer is read off the response rather
 * than assumed: `session` is null exactly when Supabase has decided to send a
 * confirmation instead. For a phone-only account that would be a dead end —
 * the mail would go to an address nobody reads — so it is reported as a
 * failure rather than as "check your inbox".
 */
export async function signUpWithPassword(
  phone: string,
  password: string,
  options: { email?: string; fullName?: string } = {},
): Promise<ActionResult<{ signedIn: boolean; userId: string; registrationEventId: string | null }>> {
  // Normalised here rather than taken as typed: the trigger in migration 039
  // copies this metadata straight into `profiles.phone`, which carries a CHECK
  // on the E.164 shape. A raw "26 341 616" would fail that at INSERT time and
  // take the whole sign-up down with it.
  const normalized = normalizePhone(phone);
  if (!normalized) return fail("invalid_phone");

  const typedEmail = options.email?.trim().toLowerCase() || null;
  const email = typedEmail ?? phoneLoginEmail(normalized);
  if (!email) return fail("invalid_phone");

  // One account per number. Without this, somebody who signed up by email last
  // month and comes back through an ad would be handed a second account — and
  // a second three days — instead of being told they already have one.
  if (await phoneAlreadyRegistered(normalized)) return fail("auth_phone_taken");

  const origin = await siteUrl();
  if (!origin) return fail(MISCONFIGURED);

  const fullName = options.fullName?.trim();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        phone: normalized,
        // The ad they came from and the answers they arrived with. See above.
        ...(await funnelMetadata()),
      },
      emailRedirectTo: `${origin}/dashboard`,
    },
  });
  if (error) {
    const code = authFailure(error);
    return fail(code === "auth_email_taken" && !typedEmail ? "auth_phone_taken" : code);
  }
  // Confirmation switched on, and no inbox to confirm from.
  if (!data.session && !typedEmail) {
    console.error("[auth] phone sign-up returned no session: is mailer_autoconfirm off?");
    return fail("auth_unavailable");
  }

  // Track new sign-up server-side when a session is created immediately.
  if (data.user) {
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.identify({
        distinctId: data.user.id,
        properties: { has_full_name: !!fullName, has_phone: true },
      });
      posthog.capture({
        distinctId: data.user.id,
        event: "user_signed_up",
        properties: {
          method: typedEmail ? "email" : "phone",
          confirmed_immediately: !!data.session,
        },
      });
      await posthog.flush();
    }
  }

  // CompleteRegistration, server half. The browser fires the same event with
  // this id, and Meta keeps whichever arrives first. An empty `identities` is
  // Supabase's disguise for "that email already has an account" when
  // confirmation is on — not a registration, so nothing is sent.
  let registrationEventId: string | null = null;
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    const eventId = `reg_${data.user.id}`;
    registrationEventId = eventId;
    const client = await readClientContext();
    const userId = data.user.id;
    after(() =>
      sendMetaEvent({
        name: "CompleteRegistration",
        eventId,
        path: "/login",
        // Never the derived address: it is not theirs, and hashing it to Meta
        // as their email would be matching on a string we invented.
        user: { id: userId, email: contactEmail(email), phone: normalized, ...client },
      }),
    );
  }

  return ok({ signedIn: !!data.session, userId: data.user?.id ?? "", registrationEventId });
}

export async function signInWithGoogle(): Promise<ActionResult<string>> {
  const origin = await siteUrl();
  if (!origin) return fail(MISCONFIGURED);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) return fail(authFailure(error));
  return ok(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Drop the cached paywall pass too — it's user-bound and would fail
  // verification anyway, but leaving it behind is just litter.
  (await cookies()).delete(GATE_COOKIE);
  redirect("/login");
}
