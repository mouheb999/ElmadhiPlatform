"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { GATE_COOKIE } from "@/lib/paywall-gate";
import { normalizePhone } from "@/lib/phone";
import { siteOrigin } from "@/lib/site-url";

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

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ActionResult<{ isAdmin: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return fail(authFailure(error));

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  return ok({ isAdmin: !!profile?.is_admin });
}

/**
 * Sign up, and report whether that already signed the user in.
 *
 * Supabase is configured with `mailer_autoconfirm` on, so `signUp` returns a
 * session and no confirmation mail is ever sent — telling someone to check an
 * inbox nothing was delivered to is how a signup dead-ends. But that is a
 * dashboard setting, not a fact about this code, so the answer is read off the
 * response rather than assumed: `session` is null exactly when Supabase has
 * decided to send a confirmation instead, and the caller shows the inbox notice
 * only then.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
  phone?: string,
): Promise<ActionResult<{ signedIn: boolean }>> {
  // Normalised here rather than taken as typed: the trigger in migration 039
  // copies this metadata straight into `profiles.phone`, which carries a CHECK
  // on the E.164 shape. A raw "26 341 616" would fail that at INSERT time and
  // take the whole sign-up down with it.
  const normalized = normalizePhone(phone);
  if (phone?.trim() && !normalized) return fail("invalid_phone");

  const origin = await siteUrl();
  if (!origin) return fail(MISCONFIGURED);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        ...(normalized ? { phone: normalized } : {}),
      },
      emailRedirectTo: `${origin}/dashboard`,
    },
  });
  if (error) return fail(authFailure(error));
  return ok({ signedIn: !!data.session });
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
