import { Suspense } from "react";
import Link from "next/link";
import { Flame, MessageCircleQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasPaidAccess } from "@/lib/subscription-server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { CheckinCard, type TodayCheckin } from "@/components/dashboard/checkin-card";
import { TodayWorkout, type TodayWorkoutDay, type TodayWorkoutState } from "@/components/dashboard/today-workout";
import { ProgressTeaser } from "@/components/dashboard/progress-teaser";
import { Reveal } from "@/components/shared/reveal";
import { UpgradeSummary } from "@/components/shared/locked";
import { NutritionSection, NutritionSectionSkeleton } from "./_sections/nutrition-section";
import { QaSparkSection, QaSparkSectionSkeleton } from "./_sections/qa-spark-section";
import { CareSection, CareSectionSkeleton } from "./_sections/care-section";
import { prevDateKey, tunisDateKey, tunisDayStartUtc, tunisWeekStartUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Consecutive-day streak over check-in dates (desc), anchored at today or yesterday (Tunis). */
function checkinStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  let cursor = tunisDateKey();
  if (datesDesc[0] !== cursor) {
    cursor = prevDateKey(cursor);
    if (datesDesc[0] !== cursor) return 0;
  }
  let streak = 0;
  for (const date of datesDesc) {
    if (date !== cursor) break;
    streak += 1;
    cursor = prevDateKey(cursor);
  }
  return streak;
}

/**
 * The Today screen. Not a summary of what the user set up once — a live
 * answer to "what does HYPE FITNESS want from me today, and what did it notice?"
 */
export default async function DashboardPage() {
  // `paid` decides whether the write controls on this page render as controls
  // or as the upgrade card. The dashboard itself is free to reach — see
  // lib/access — so an unpaid account lands here, reads its plan, and meets the
  // wall only at the point of recording something.
  const [supabase, locale, user, paid] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
    hasPaidAccess(),
  ]);

  // "Today" and "this week" in Africa/Tunis — never server-local time.
  const today = tunisDateKey();
  const todayStart = tunisDayStartUtc();
  const weekStart = tunisWeekStartUtc();

  // Round 1: everything that depends on nothing but the user id. This page
  // used to run five sequential round-trips; anything not genuinely waiting on
  // an earlier id belongs here.
  const [
    { data: profile },
    { data: trainingProfile },
    { data: checkins },
    { data: answeredRequests },
    { data: openSession },
    { data: weekSessionsRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("training_profiles")
      .select("id, days_per_week")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("checkin_date, weight_kg, energy, sleep_hours")
      .eq("user_id", user!.id)
      .order("checkin_date", { ascending: false })
      .limit(60),
    supabase
      .from("qa_requests")
      .select("id")
      .eq("user_id", user!.id)
      .eq("status", "published")
      .is("answered_seen_at", null),
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id")
      .eq("user_id", user!.id)
      .is("completed_at", null)
      .maybeSingle(),
    // Every session finished this week. Narrowing it to the active program's
    // days needs those day ids, which arrive in round 2 — so that filter moves
    // to the intersection below instead of holding this query back a round.
    supabase
      .from("workout_sessions")
      .select("id, completed_at, user_program_day_id")
      .eq("user_id", user!.id)
      .not("completed_at", "is", null)
      .gte("completed_at", weekStart.toISOString()),
  ]);

  // Round 2, and the last one. The program's days used to be a third round of
  // their own, because they need the program id — but PostgREST will embed
  // them, so "which program" and "what's in it" arrive together.
  const { data: program } = trainingProfile
    ? await supabase
        .from("user_programs")
        .select(
          "id, user_program_days(id, day_number, day_name, user_program_exercises(count))",
        )
        .eq("training_profile_id", trainingProfile.id)
        .eq("is_active", true)
        .order("day_number", {
          referencedTable: "user_program_days",
          ascending: true,
        })
        .maybeSingle()
    : { data: null };

  // ---- Training: what does today look like? ----
  let workoutState: TodayWorkoutState = "none";
  let todayDay: TodayWorkoutDay | null = null;
  let weekDone = 0;
  const weekTarget = trainingProfile?.days_per_week ?? 0;

  if (trainingProfile) {
    if (program) {
      type ProgramDayRow = {
        id: string;
        day_number: number;
        day_name: string;
        user_program_exercises: { count: number }[];
      };
      const daysRaw = (program as unknown as { user_program_days?: ProgramDayRow[] })
        .user_program_days;
      const days = ((daysRaw ?? []) as ProgramDayRow[]).map((d) => ({
        id: d.id,
        dayNumber: d.day_number,
        dayName: d.day_name,
        exerciseCount: d.user_program_exercises?.[0]?.count ?? 0,
      }));

      if (days.length > 0) {
        // The day filter the query above deferred: sessions belonging to a
        // program the user has since replaced still don't count.
        const dayIds = new Set(days.map((d) => d.id));
        const weekSessions = (weekSessionsRaw ?? []).filter(
          (s) => s.user_program_day_id && dayIds.has(s.user_program_day_id),
        );

        // Weekly gate: each day counts once per Tunis week, any order.
        const doneDayIds = new Set(
          weekSessions.map((s) => s.user_program_day_id).filter(Boolean),
        );
        weekDone = doneDayIds.size;
        const doneToday = weekSessions.some(
          (s) => s.completed_at && new Date(s.completed_at) >= todayStart,
        );
        const openDay = openSession?.user_program_day_id
          ? days.find((d) => d.id === openSession.user_program_day_id)
          : undefined;

        if (openDay) {
          todayDay = { id: openDay.id, name: openDay.dayName, exerciseCount: openDay.exerciseCount };
          workoutState = "in_progress";
        } else if (doneToday) {
          workoutState = "done";
        } else if (weekDone >= Math.min(weekTarget || days.length, days.length)) {
          workoutState = "rest";
        } else {
          // First day (by program order) not yet completed this week.
          const next = days.find((d) => !doneDayIds.has(d.id)) ?? days[0];
          todayDay = { id: next.id, name: next.dayName, exerciseCount: next.exerciseCount };
          workoutState = "ready";
        }
      }
    }
  }

  // ---- Check-in state ----
  const todayCheckinRow = (checkins ?? []).find((c) => c.checkin_date === today);
  const todayCheckin: TodayCheckin = todayCheckinRow
    ? {
        weightKg: todayCheckinRow.weight_kg,
        energy: todayCheckinRow.energy,
        sleepHours: todayCheckinRow.sleep_hours,
      }
    : null;
  const lastWeightKg = (checkins ?? []).find((c) => c.weight_kg !== null)?.weight_kg ?? null;
  const streak = checkinStreak((checkins ?? []).map((c) => c.checkin_date));
  // Teaser sparkline: last 14 logged weights, oldest first (checkins are desc).
  const teaserWeights = (checkins ?? [])
    .filter((c) => c.weight_kg !== null)
    .slice(0, 14)
    .map((c) => c.weight_kg as number)
    .reverse();

  const firstName = profile?.full_name?.split(" ")[0];
  const hasAnsweredQa = (answeredRequests ?? []).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t(locale, "dashboard.greeting")}</p>
          {firstName && <h2 className="text-lg font-extrabold">{firstName}</h2>}
        </div>
        {(streak > 1 || weekTarget > 0) && (
          <div className="flex gap-2">
            {streak > 1 && (
              <span className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-bold">
                <Flame className="h-3.5 w-3.5 text-accent" />
                {streak} {t(locale, "today.streak_label")}
              </span>
            )}
            {weekTarget > 0 && (
              <Link
                href="/review"
                className="rounded-full border border-hairline px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:border-accent/50 hover:text-accent"
              >
                {t(locale, "today.week_label")}: {weekDone}/{weekTarget} {t(locale, "today.sessions_label")}
              </Link>
            )}
          </div>
        )}
      </div>

      {hasAnsweredQa && (
        <Link
          href="/qa"
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 transition-colors hover:bg-accent/15"
        >
          <MessageCircleQuestion className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1 text-sm font-bold">{t(locale, "today.qa_answered")}</span>
          <span className="text-sm font-bold text-accent">{t(locale, "qa.answered_read")} →</span>
        </Link>
      )}

      {/* Above the workout card on purpose: for an account with a clinical
          file, whether today is a training day at all is decided here, and
          reading "Start session" first and "today is dialysis" second is the
          wrong order to meet those two facts in. Renders nothing — not even a
          gap — for every account without one. */}
      <Suspense fallback={<CareSectionSkeleton />}>
        <CareSection locale={locale} userId={user!.id} />
      </Suspense>

      <Reveal>
        <TodayWorkout locale={locale} state={workoutState} day={todayDay} locked={!paid} />
      </Reveal>

      {/* Both of these are write-first cards — an empty check-in form and a
          chart of data an unpaid account has none of. Rendering a lock in place
          of each turned Today into a column of padlocks, which is precisely the
          impression the free tier exists to avoid. Unpaid users get the plan
          they own, then one summary at the end. */}
      {paid && (
        <>
          <Reveal delay={0.05}>
            <CheckinCard locale={locale} todayCheckin={todayCheckin} lastWeightKg={lastWeightKg} />
          </Reveal>

          <Reveal delay={0.1}>
            <ProgressTeaser
              locale={locale}
              points={teaserWeights}
              weekDone={weekDone}
              weekTarget={weekTarget}
            />
          </Reveal>
        </>
      )}

      {/* Below the fold and independent of everything above, so neither gets
          to decide when the coaching content paints. */}
      <Reveal delay={0.15}>
        <Suspense fallback={<NutritionSectionSkeleton />}>
          <NutritionSection locale={locale} userId={user!.id} />
        </Suspense>
      </Reveal>

      {/* After their program and their macros, not before. */}
      {!paid && (
        <Reveal delay={0.15}>
          <UpgradeSummary locale={locale} />
        </Reveal>
      )}

      <Reveal delay={0.2}>
        <Suspense fallback={<QaSparkSectionSkeleton />}>
          <QaSparkSection locale={locale} />
        </Suspense>
      </Reveal>
    </div>
  );
}
