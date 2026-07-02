import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const locale = await getLocale();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/checkout");

  const [{ data: profile }, { data: settings }, { data: methods }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("payment_status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("is_enabled", true)
        .order("order_index", { ascending: true }),
    ]);

  return (
    <CheckoutClient
      locale={locale}
      email={user.email ?? ""}
      paymentStatus={profile?.payment_status ?? "unpaid"}
      settings={settings ?? null}
      methods={methods ?? []}
    />
  );
}
