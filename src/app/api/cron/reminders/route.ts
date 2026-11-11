import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaidTerm } from "@/lib/subscription";
import { tunisDayStartUtc } from "@/lib/dates";
import { REMINDER_COPY, pickReminder, type ReminderKind } from "@/lib/push/reminders";
import { pushConfigured, sendPush } from "@/lib/push/send";

/**
 * The daily reminder run.
 *
 * Called once a day by the host's scheduler (see vercel.json: 17:00 UTC, which
 * is early evening in Tunis — late enough that "nothing logged today" is true,
 * early enough that dinner has not happened yet). For every browser with
 * reminders on it works out which reminder applies, if any, and sends it. The
 * rules live in lib/push/reminders.ts; this file only gathers what they need.
 *
 * Guarded by CRON_SECRET as a bearer token, which is what Vercel Cron sends
 * when that variable is set. It rejects by default: with no secret configured
 * the endpoint is dead, because an open URL that pushes notifications to every
 * member is not something to leave reachable.
 *
 * Uses the service role: there is no member session here, and the job reads
 * across accounts by design.
 *
 * Sized for a member base in the hundreds — it makes a handful of queries for
 * the whole run, not per member. If that stops being true, page the
 * subscriptions.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The newest timestamp per user out of rows already ordered newest first. */
function newestPerUser(rows: { user_id: string; at: string | null }[] | null, into: Map<string, number>) {
  for (const row of rows ?? []) {
    if (!row.at) continue;
    const at = Date.parse(row.at);
    if (Number.isNaN(at)) continue;
    if (at > (into.get(row.user_id) ?? 0)) into.set(row.user_id, at);
  }
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: true, skipped: "push not configured" });

  const admin = createAdminClient();
  const now = new Date();

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, locale, last_sent_at, last_kind");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  // Anything older than this cannot change which reminder is picked.
  const since = new Date(now.getTime() - 15 * 86_400_000).toISOString();

  const [{ data: profiles }, { data: meals }, { data: sessions }, { data: checkins }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, payment_status, plan_expires_at, free_access_until, is_admin")
        .in("id", userIds),
      admin
        .from("meal_logs")
        .select("user_id, logged_at")
        .in("user_id", userIds)
        .gte("logged_at", since),
      admin
        .from("workout_sessions")
        .select("user_id, completed_at")
        .in("user_id", userIds)
        .gte("completed_at", since),
      admin
        .from("daily_checkins")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .gte("created_at", since),
    ]);

  const lastActivity = new Map<string, number>();
  newestPerUser((meals ?? []).map((m) => ({ user_id: m.user_id, at: m.logged_at })), lastActivity);
  newestPerUser((sessions ?? []).map((s) => ({ user_id: s.user_id, at: s.completed_at })), lastActivity);
  newestPerUser((checkins ?? []).map((c) => ({ user_id: c.user_id, at: c.created_at })), lastActivity);

  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  const todayStart = tunisDayStartUtc(now).getTime();

  const counts: Record<ReminderKind | "gone" | "failed", number> = {
    trial_last_day: 0,
    trial_ended: 0,
    come_back: 0,
    log_today: 0,
    gone: 0,
    failed: 0,
  };

  for (const subscription of subscriptions) {
    const profile = profileOf.get(subscription.user_id);
    // An admin is the person running this; they do not need nudging.
    if (!profile || profile.is_admin) continue;

    const last = lastActivity.get(subscription.user_id) ?? null;
    const kind = pickReminder(
      {
        paid: hasPaidTerm(profile, now),
        freeAccessUntil: profile.free_access_until,
        lastActivityAt: last ? new Date(last).toISOString() : null,
        loggedToday: last !== null && last >= todayStart,
        lastSentAt: subscription.last_sent_at,
        lastKind: subscription.last_kind,
      },
      now,
    );
    if (!kind) continue;

    const copy = REMINDER_COPY[kind];
    const text = subscription.locale === "en" ? copy.en : copy.tn;
    const result = await sendPush(subscription, { ...text, url: copy.url, tag: `hype-${kind}` });

    if (result === "sent") {
      counts[kind] += 1;
      await admin
        .from("push_subscriptions")
        .update({ last_sent_at: now.toISOString(), last_kind: kind })
        .eq("id", subscription.id);
    } else if (result === "gone") {
      counts.gone += 1;
      await admin.from("push_subscriptions").delete().eq("id", subscription.id);
    } else {
      counts.failed += 1;
    }
  }

  return NextResponse.json({ ok: true, ...counts });
}
