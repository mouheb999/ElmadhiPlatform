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

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ActionResult<{ isAdmin: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return fail(error.message);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  return ok({ isAdmin: !!profile?.is_admin });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
  phone?: string,
): Promise<ActionResult> {
  // Normalised here rather than taken as typed: the trigger in migration 039
  // copies this metadata straight into `profiles.phone`, which carries a CHECK
  // on the E.164 shape. A raw "26 341 616" would fail that at INSERT time and
  // take the whole sign-up down with it.
  const normalized = normalizePhone(phone);
  if (phone?.trim() && !normalized) return fail("invalid_phone");

  const origin = await siteUrl();
  if (!origin) return fail(MISCONFIGURED);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
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
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function signInWithGoogle(): Promise<ActionResult<string>> {
  const origin = await siteUrl();
  if (!origin) return fail(MISCONFIGURED);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) return fail(error.message);
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
