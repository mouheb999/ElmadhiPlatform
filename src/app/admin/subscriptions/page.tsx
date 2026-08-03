import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { subscriptionStanding, type SubscriptionStanding } from "@/lib/subscription";
import { SubscriptionsClient, type SubscriptionRow } from "./subscriptions-client";

export const dynamic = "force-dynamic";

/** Newest accounts first is the tie-breaker; the real ordering is by urgency. */
const MAX_ROWS = 1000;

/** Who gets chased first. Someone about to lapse is more useful to see than
 *  someone who lapsed in March and never came back. */
const URGENCY: Record<SubscriptionStanding, number> = {
  expiring: 0,
  active: 1,
  expired: 2,
  unpaid: 3,
};

/**
 * Every account and where its subscription stands. Read-only: activation still
 * happens on the payments page, where the paid-for term is what gets recorded.
 * This is the view that answers "who am I about to lose".
 */
export default async function AdminSubscriptionsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();
  const db = createAdminClient();

  const { data: profiles } = await db
    .from("profiles")
    .select(
      "id, full_name, email, payment_status, plan_type, plan_expires_at, is_admin, paid_at, phone, locale, contacted_at",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const now = new Date();
  const rows: SubscriptionRow[] = (profiles ?? []).map((profile) => {
    const { standing, daysLeft } = subscriptionStanding(profile, now);
    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      // An admin account is never gated, so labelling it "expired" would be a
      // lie — it is called out separately instead.
      standing: profile.is_admin ? "active" : standing,
      isAdmin: !!profile.is_admin,
      planType: profile.plan_type,
      expiresAt: profile.plan_expires_at,
      paidAt: profile.paid_at,
      daysLeft: profile.is_admin ? null : daysLeft,
      phone: profile.phone,
      userLocale: profile.locale,
      contactedAt: profile.contacted_at,
    };
  });

  rows.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? 1 : -1;
    if (URGENCY[a.standing] !== URGENCY[b.standing]) {
      return URGENCY[a.standing] - URGENCY[b.standing];
    }
    // Inside a group: soonest to lapse first, and among the already-lapsed the
    // most recent, since those are the ones still worth a message.
    const aDays = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysLeft ?? Number.POSITIVE_INFINITY;
    return a.standing === "expired" ? bDays - aDays : aDays - bDays;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t(locale, "admin.subs_title")}
        </h1>
        <p className="text-muted">{t(locale, "admin.subs_sub")}</p>
      </div>
      <SubscriptionsClient locale={locale} rows={rows} />
    </div>
  );
}
