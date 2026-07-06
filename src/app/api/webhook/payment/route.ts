import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment webhook stub.
 * TODO(mouheb): replace shared-secret check with real Konnect/Flouci HMAC
 * verification once a provider is chosen. Expected payload: { userId: string }.
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

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      has_paid: true,
      payment_status: "active",
      paid_at: new Date().toISOString(),
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
