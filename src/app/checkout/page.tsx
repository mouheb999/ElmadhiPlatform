import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { isUnread } from "@/lib/support";
import { CheckoutClient, type PaymentThread } from "./checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; plan?: string }>;
}) {
  const supabase = await createClient();
  const locale = await getLocale();

  // No redirect for a signed-out visitor. This page is the sales page — the
  // preview of the app, the plans and the prices — and gating it behind an
  // account meant nobody saw the product until after they had filled in a
  // form. The account is asked for when they pick a plan; the client renders
  // step 1 and nothing past it while `signedIn` is false, and every action
  // behind it refuses an unauthenticated caller anyway.
  //
  // Plans, settings and methods are public-read by RLS (migrations 009, 017),
  // so the anon session below can fetch them.
  const user = await getCurrentUser();

  // Which locked control sent them here, so step 1 can open by naming the thing
  // they reached for instead of a generic pitch. Set by the proxy redirect and
  // by the in-app upgrade cards. `plan` survives the trip through signup, so
  // somebody who chose Premium / 3 months comes back to Premium / 3 months.
  const { from, plan: planId } = await searchParams;

  const [{ data: settings }, { data: methods }, { data: plans }] = await Promise.all([
    supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("payment_methods")
      .select("*")
      .eq("is_enabled", true)
      .order("order_index", { ascending: true }),
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_enabled", true)
      .order("months", { ascending: true }),
  ]);

  // Everything below is about a specific account, so it is only read when
  // there is one.
  const [{ data: profile }, { data: openRequest }] = user
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("payment_status, plan_type, plan_expires_at")
          .eq("id", user.id)
          .maybeSingle(),
        // Their most recent attempt, whatever became of it. `pending` drives
        // the review screen; `rejected` tells them the last one was turned
        // down so they are not left guessing why they are back at step one.
        supabase
          .from("payment_requests")
          .select("id, status, proof_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const expired =
    !!profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date();

  // The conversation attached to the open request (migration 044). This is what
  // turns the review screen from a status light into somewhere the customer can
  // actually say "I sent it from my brother's account" and get an answer.
  let thread: PaymentThread | null = null;
  if (user && openRequest?.status === "pending") {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, last_admin_reply_at, user_seen_at, support_messages(id, sender, body, created_at)")
      .eq("payment_request_id", openRequest.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ticket) {
      type MessageRow = { id: string; sender: string; body: string; created_at: string | null };
      const messages = ((ticket.support_messages ?? []) as MessageRow[])
        .slice()
        .sort((a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""));
      thread = {
        ticketId: ticket.id,
        hasUnreadReply: isUnread(ticket.last_admin_reply_at, ticket.user_seen_at),
        messages: messages.map((m) => ({
          id: m.id,
          sender: m.sender === "admin" ? "admin" : "user",
          body: m.body,
          createdAt: m.created_at,
        })),
      };
    }
  }

  return (
    <CheckoutClient
      locale={locale}
      signedIn={!!user}
      initialPlanId={planId ?? null}
      email={user?.email ?? ""}
      paymentStatus={expired ? "unpaid" : (profile?.payment_status ?? "unpaid")}
      planExpiresAt={profile?.plan_expires_at ?? null}
      isRenewal={expired}
      hasProof={openRequest?.status === "pending" && !!openRequest.proof_path}
      hasOpenRequest={openRequest?.status === "pending"}
      wasRejected={openRequest?.status === "rejected"}
      thread={thread}
      from={from ?? null}
      settings={settings ?? null}
      methods={methods ?? []}
      plans={plans ?? []}
    />
  );
}
