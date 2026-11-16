import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { hoursSince } from "@/lib/dates";
import { contactEmail, formatPhone } from "@/lib/phone";
import { dayPart, summarizeRevenue } from "@/lib/admin-overview";
import { subscriptionStanding } from "@/lib/subscription";
import { summarizeTrials, trialDaysLeft, trialStatus } from "@/lib/trials";
import { OverviewView, type OverviewData } from "./overview-view";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * The admin home: this month's revenue, what is waiting on a person, and the
 * headline counts. Read-only — every card links to the page where the work is
 * done. The payments queue that used to live here is at /admin/payments.
 */
export default async function AdminOverviewPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  const locale = await getLocale();
  const db = createAdminClient();
  // One clock for the whole page, so the cards agree with each other.
  const now = new Date();
  // Far enough back to cover all of last month for the comparison.
  const revenueSince = new Date(now.getTime() - 70 * DAY_MS).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [
    { data: me },
    { data: confirmed },
    { data: pending },
    { count: openTickets },
    { count: pendingQuestions },
    { data: subscribers },
    { data: trials },
    { count: signups7d },
  ] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", admin.id).maybeSingle(),
    db
      .from("payment_requests")
      .select("id, user_id, amount_tnd, resolved_at")
      .eq("status", "confirmed")
      .gte("resolved_at", revenueSince)
      .order("resolved_at", { ascending: false }),
    db.from("payment_requests").select("amount_tnd, created_at").eq("status", "pending"),
    db.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("qa_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db
      .from("profiles")
      .select("payment_status, plan_expires_at")
      .eq("payment_status", "active")
      .eq("is_admin", false),
    db
      .from("profiles")
      .select("id, created_at, free_access_until, payment_status, paid_at")
      .eq("is_admin", false)
      .not("free_access_until", "is", null)
      .limit(2000),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", false)
      .gte("created_at", weekAgo),
  ]);

  // Who the latest payments came from. One query for the five on show.
  const latest = (confirmed ?? []).slice(0, 5);
  const { data: payers } = latest.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", [...new Set(latest.map((p) => p.user_id))])
    : { data: [] };
  const payerById = new Map((payers ?? []).map((p) => [p.id, p]));

  const stampFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });

  const standings = (subscribers ?? []).map((s) => subscriptionStanding(s, now).standing);
  const trialRows = trials ?? [];
  const trialSummary = summarizeTrials(trialRows, now);
  const pendingRows = pending ?? [];
  const waits = pendingRows
    .map((p) => hoursSince(p.created_at, now.getTime()))
    .filter((h): h is number => h !== null);

  const data: OverviewData = {
    adminName: me?.full_name?.trim().split(/\s+/)[0] || null,
    greeting: dayPart(now),
    dateLabel: new Intl.DateTimeFormat(locale === "tn" ? "ar-TN-u-nu-latn" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Africa/Tunis",
    }).format(now),
    revenue: summarizeRevenue(confirmed ?? [], now),
    queue: {
      pendingPayments: pendingRows.length,
      pendingAmount: pendingRows.reduce((sum, p) => sum + (Number(p.amount_tnd) || 0), 0),
      oldestPendingHours: waits.length ? Math.max(...waits) : null,
      openTickets: openTickets ?? 0,
      pendingQuestions: pendingQuestions ?? 0,
      // Still unpaid with a day or less left: the last moment a message helps.
      trialsEndingSoon: trialRows.filter(
        (p) => trialStatus(p, now) === "active" && trialDaysLeft(p, now) === 1,
      ).length,
      expiringSubs: standings.filter((s) => s === "expiring").length,
    },
    kpis: {
      activeSubscribers: standings.filter((s) => s === "active" || s === "expiring").length,
      inTrial: trialSummary.byStatus.active,
      newTrials7d: trialSummary.started.week,
      signups7d: signups7d ?? 0,
    },
    recent: latest.map((p) => {
      const payer = payerById.get(p.user_id);
      return {
        id: p.id,
        name:
          payer?.full_name?.trim() ||
          contactEmail(payer?.email) ||
          (payer?.phone ? formatPhone(payer.phone) : "—"),
        amount: Number(p.amount_tnd) || 0,
        when: p.resolved_at ? stampFmt.format(new Date(p.resolved_at)) : "",
      };
    }),
  };

  return <OverviewView locale={locale} data={data} />;
}
