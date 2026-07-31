import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextExpiry } from "@/lib/subscription";

/**
 * Payment webhook stub.
 * TODO(mouheb): replace shared-secret check with real Konnect/Flouci HMAC
 * verification once a provider is chosen. Expected payload:
 * { userId: string, months?: number, tier?: "standard" | "premium" }.
 *
 * Rejects by default: if PAYMENT_WEBHOOK_SECRET is unset the endpoint is dead.
 * Uses the service-role client because the webhook has no user session and
 * must bypass RLS to flip another user's payment fields.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-webhook-signature");
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!secret || !signature || !constantTimeMatch(signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { userId?: string; months?: number; tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const months = Number.isFinite(body.months) ? Math.round(body.months!) : 1;
  if (months < 1 || months > 24) {
    return NextResponse.json({ error: "Invalid months" }, { status: 400 });
  }
  const tier = body.tier === "standard" ? "standard" : "premium";

  const admin = createAdminClient();

  // The term is the whole point of activating an account. This endpoint used
  // to set `payment_status = 'active'` and nothing else, and the paywall reads
  // a missing `plan_expires_at` as "no end date" — so every customer paid
  // through here would have got the product free, forever. Same math as the
  // admin confirmation path: a renewal extends, a lapsed plan restarts.
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", body.userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }

  const now = new Date();
  const { error } = await admin
    .from("profiles")
    .update({
      has_paid: true,
      payment_status: "active",
      paid_at: now.toISOString(),
      plan_type: tier,
      plan_expires_at: nextExpiry(profile.plan_expires_at, months, now).toISOString(),
    })
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
