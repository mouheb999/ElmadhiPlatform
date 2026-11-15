import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { contactEmail } from "@/lib/phone";
import { summarizeTrials, trialDaysLeft, trialStatus } from "@/lib/trials";
import { TrialsClient, type TrialRow } from "./trials-client";

export const dynamic = "force-dynamic";

/** Plenty for the list; the counts are taken over the same rows. */
const MAX_ROWS = 2000;

/**
 * How many free trials are being started, and what happens to them.
 *
 * Every number on this page is derived from `profiles` alone (see lib/trials
 * for what counts as a trial). Read-only: chasing happens over WhatsApp from
 * the list, activation still happens on the payments page.
 */
export default async function AdminTrialsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();
  const { data: profiles } = await createAdminClient()
    .from("profiles")
    .select(
      "id, full_name, email, phone, locale, created_at, free_access_until, payment_status, paid_at, contacted_at",
    )
    .eq("is_admin", false)
    .not("free_access_until", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  // One clock for the whole page, so a row's badge and the totals agree.
  const now = new Date();
  const list = profiles ?? [];
  const summary = summarizeTrials(list, now);
  const rows: TrialRow[] = list.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: contactEmail(p.email),
    phone: p.phone,
    userLocale: p.locale,
    createdAt: p.created_at,
    status: trialStatus(p, now),
    daysLeft: trialDaysLeft(p, now),
    contactedAt: p.contacted_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t(locale, "admin.trials_title")}
        </h1>
        <p className="text-muted">{t(locale, "admin.trials_sub")}</p>
      </div>
      <TrialsClient locale={locale} summary={summary} rows={rows} />
    </div>
  );
}
