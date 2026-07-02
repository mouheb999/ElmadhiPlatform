import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment webhook stub.
 * TODO(mouheb): replace fake signature check with real Konnect/Flouci HMAC
 * verification once a provider is chosen. Expected payload: { userId: string }.
 *
 * Uses the service-role client because the webhook has no user session and
 * must bypass RLS to flip another user's has_paid flag.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-webhook-signature");
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!secret || signature !== secret) {
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
    .update({ has_paid: true })
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
