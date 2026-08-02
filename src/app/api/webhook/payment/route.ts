import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextExpiry } from "@/lib/subscription";

/**
 * Payment webhook.
 *
 * TODO(mouheb): when Konnect/Flouci is chosen, replace `verifySignature` with
 * that provider's scheme. Everything below it already assumes a verified body.
 * Expected payload: { userId: string, months?: number, tier?: "standard" | "premium" }.
 *
 * This endpoint grants paid access to an arbitrary user id, so what guards it
 * matters more than what it does. It previously compared the
 * `x-webhook-signature` header against PAYMENT_WEBHOOK_SECRET directly — which
 * is a bearer token, not a signature: it was not bound to the body, so anyone
 * who ever saw the header (a proxy log, a misrouted request, a provider
 * dashboard) could replay it with a userId of their choosing, forever.
 *
 * Now: HMAC-SHA256 over `${timestamp}.${rawBody}`, with the timestamp inside
 * the signed material and a five-minute window. A captured request can only be
 * replayed byte-for-byte, and only for five minutes.
 *
 * Rejects by default: if PAYMENT_WEBHOOK_SECRET is unset the endpoint is dead.
 * Uses the service-role client because the webhook has no user session and must
 * bypass RLS to flip another user's payment fields.
 */

/** How long a signed request stays acceptable. Bounds replay of a capture. */
const TOLERANCE_SECONDS = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // The signature covers the exact bytes, so the body must be read as text and
  // parsed afterwards — request.json() would verify a re-serialized payload.
  const rawBody = await request.text();
  if (!verifySignature(request.headers.get("x-webhook-signature"), rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { userId?: string; months?: number; tier?: string };
  try {
    body = JSON.parse(rawBody);
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

/**
 * Verifies a `t=<unix-seconds>,v1=<hex-hmac>` header against the raw body.
 *
 * The timestamp is part of the signed material, so it cannot be edited to
 * refresh a captured request without invalidating the digest.
 */
function verifySignature(
  header: string | null,
  rawBody: string,
  secret: string,
): boolean {
  if (!header) return false;

  let timestamp: string | undefined;
  let provided: string | undefined;
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t") timestamp = value;
    else if (key === "v1") provided = value;
  }
  if (!timestamp || !provided) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // Hex of a fixed-width digest, so a length mismatch means malformed input
  // rather than a near-miss — nothing is leaked by returning early on it.
  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
