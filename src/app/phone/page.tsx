import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { safeNextPath } from "@/lib/safe-redirect";
import { PhoneForm } from "./phone-form";

export const dynamic = "force-dynamic";

/**
 * Collects a contact number from accounts that have none.
 *
 * Google sign-in never yields a phone, and neither did any sign-up before
 * migration 039 — so this is the one place that backfills every account that
 * predates the field, not just OAuth ones. The gate in `proxy.ts` sends people
 * here; this page bounces them back out if they already have a number, so a
 * stale redirect can't strand anybody on a form they've already filled.
 */
export default async function PhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const next = safeNextPath((await searchParams).next);

  if (!user) redirect(`/login?next=${encodeURIComponent(`/phone?next=${next}`)}`);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.phone) redirect(next);

  return <PhoneForm locale={await getLocale()} next={next} />;
}
