import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const locale = await getLocale();

  /**
   * What they are here to buy, when they came from the checkout screen.
   *
   * Somebody who walked the preview, chose Premium / 3 months and was sent
   * here to make an account should see that decision on this screen — a form
   * that arrives with no memory of what preceded it reads as an interruption
   * rather than the next step in a purchase.
   *
   * Looked up by id rather than passed as text: a label carried in the query
   * string is a line of copy anybody can write on our sign-up page.
   */
  const { plan: planId } = await searchParams;
  let plan: { tier: string; months: number; price_tnd: number } | null = null;
  if (planId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select("tier, months, price_tnd")
      .eq("id", planId)
      .eq("is_enabled", true)
      .maybeSingle();
    plan = data;
  }

  return (
    <Suspense fallback={null}>
      <LoginForm locale={locale} plan={plan} />
    </Suspense>
  );
}
