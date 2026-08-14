import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();
  const locale = await getLocale();

  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/checkout");

  // Which locked control sent them here, so step 1 can open by naming the thing
  // they reached for instead of a generic pitch. Set by the proxy redirect and
  // by the in-app upgrade cards.
  const { from } = await searchParams;

  const [{ data: profile }, { data: settings }, { data: methods }, { data: plans }, { data: openRequest }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("payment_status, plan_type, plan_expires_at")
        .eq("id", user.id)
        .maybeSingle(),
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
      // Their most recent attempt, whatever became of it. `pending` drives the
      // review screen; `rejected` tells them the last one was turned down so
      // they are not left guessing why they are back at step one.
      supabase
        .from("payment_requests")
        .select("status, proof_path")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const expired =
    !!profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date();

  return (
    <CheckoutClient
      locale={locale}
      email={user.email ?? ""}
      paymentStatus={expired ? "unpaid" : (profile?.payment_status ?? "unpaid")}
      planExpiresAt={profile?.plan_expires_at ?? null}
      isRenewal={expired}
      hasProof={openRequest?.status === "pending" && !!openRequest.proof_path}
      wasRejected={openRequest?.status === "rejected"}
      from={from ?? null}
      settings={settings ?? null}
      methods={methods ?? []}
      plans={plans ?? []}
    />
  );
}
