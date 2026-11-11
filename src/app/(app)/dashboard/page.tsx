import { Suspense } from "react";
import Link from "next/link";
import { Flame, MessageCircleQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasPaidAccess } from "@/lib/subscription-server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { CheckinCard, type TodayCheckin } from "@/components/dashboard/checkin-card";
import {
  TodayWorkout,
  type TodayExercise,
  type TodayWorkoutDay,
  type TodayWorkoutState,
} from "@/components/dashboard/today-workout";
import { ProgressTeaser } from "@/components/dashboard/progress-teaser";
import { Locked, UpgradeSummary } from "@/components/shared/locked";
import { NutritionSection, NutritionSectionSkeleton } from "./_sections/nutrition-section";
import { RingsSection, RingsSectionSkeleton } from "./_sections/rings-section";
import { QaSparkSection, QaSparkSectionSkeleton } from "./_sections/qa-spark-section";
import { prevDateKey, tunisDateKey, tunisDayStartUtc, tunisWeekStartUtc } from "@/lib/dates";
import { isAppShell } from "@/lib/app-shell";
import { PageHeader, todayEyebrow } from "@/components/shared/page-header";
import { LOCK_REASON } from "@/components/shared/locked";
import type { LockedFeature } from "@/lib/access";

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
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string }>;
}) {
  // `paid` decides whether the write controls on this page render as controls
  // or as the upgrade card. The dashboard itself is free to reach — see
  // lib/access — so an unpaid account lands here, reads its plan, and meets the
  // wall only at the point of recording something.
  const [supabase, locale, user, paid, appShell] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
    hasPaidAccess(),
    // Request-cached, and the header is already in hand — this adds no I/O.
    isAppShell(),
  ]);

  /**
   * What they just tried to open, when the proxy sent them here.
   *
   * Only the app's gate redirects to this screen — on the web an unpaid tap
   * goes to /checkout, which names the feature itself through `?from=`. So this
   * is the app's equivalent: the dashboard is the destination, and without this
   * a tap on Progress would land on an unchanged Today screen with no
   * acknowledgement that anything had been refused.
   *
   * Validated against LOCK_REASON rather than cast, because it arrives in a URL
   * anyone can edit and it indexes into a copy table.
   */
  const { locked: lockedRaw } = await searchParams;
  const lockedFeature: LockedFeature | null =
    lockedRaw && lockedRaw in LOCK_REASON ? (lockedRaw as LockedFeature) : null;

  // "Today" and "this week" in Africa/Tunis — never server-local time.
  const today = tunisDateKey();
  const todayStart = tunisDayStartUtc();
  const weekStart = tunisWeekStartUtc();

  // Round 1: everything that depends on nothing but the user id. This page
  // used to run five sequential round-trips; anything not genuinely waiting on
  // an earlier id belongs here.
  const [
    { data: trainingProfile },
    { data: checkins },
    { data: answeredRequests },
    { data: openSession },
    { data: weekSessionsRaw },
  ] = await Promise.all([
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
          "id, user_program_days(id, day_number, day_name, user_program_exercises(order_index, sets, rep_range, exercises(name_en, name_ar)))",
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
        user_program_exercises: {
          order_index: number;
          sets: number;
          rep_range: string;
          exercises: { name_en: string; name_ar: string | null } | null;
        }[];
      };
      const daysRaw = (program as unknown as { user_program_days?: ProgramDayRow[] })
        .user_program_days;
      const days = ((daysRaw ?? []) as ProgramDayRow[]).map((d) => {
        // Program order, and only rows whose exercise still exists — a deleted
        // catalog row would otherwise leave a nameless card on the shelf.
        const exercises: TodayExercise[] = [...(d.user_program_exercises ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .flatMap((row) =>
            row.exercises
              ? [
                  {
                    nameEn: row.exercises.name_en,
                    nameAr: row.exercises.name_ar,
                    sets: row.sets,
                    repRange: row.rep_range,
                  },
                ]
              : [],
          );
        return {
          id: d.id,
          dayNumber: d.day_number,
          dayName: d.day_name,
          exerciseCount: exercises.length,
          exercises,
        };
      });

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
          todayDay = {
            id: openDay.id,
            name: openDay.dayName,
            exerciseCount: openDay.exerciseCount,
            exercises: openDay.exercises,
          };
          workoutState = "in_progress";
        } else if (doneToday) {
          workoutState = "done";
        } else if (weekDone >= Math.min(weekTarget || days.length, days.length)) {
          workoutState = "rest";
        } else {
          // First day (by program order) not yet completed this week.
          const next = days.find((d) => !doneDayIds.has(d.id)) ?? days[0];
          todayDay = {
            id: next.id,
            name: next.dayName,
            exerciseCount: next.exerciseCount,
            exercises: next.exercises,
          };
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

  const hasAnsweredQa = (answeredRequests ?? []).length > 0;

  // Today's date in Tunis, in the reader's language. ar-TN uses Western digits
  // by default, matching the rest of the Arabic UI.
  const dateLabel = todayEyebrow(locale);

  /*
   * Layout, top to bottom: a large title, the rings, today's session, food,
   * the check-in, weight, then one card from the library.
   *
   * Nothing here animates in. The six fade-and-rise wrappers that used to
   * stagger every section replayed on every visit to the tab — a home screen
   * that re-introduces itself each time you come back is the clearest single
   * tell that an app is a web page. The rings are the one exception, and they
   * earn it: what animates is your progress filling in.
   */
  return (
    <div className="flex flex-col gap-8 pb-4">
      <div className="flex flex-col gap-3.5">
        <PageHeader
          eyebrow={dateLabel}
          title={t(locale, "nav.today")}
          trailing={
            streak > 1 ? (
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold">
                <Flame className="h-4 w-4 text-fuel" />
                <span className="font-num text-fuel">{streak}</span>
                <span className="text-subtle">{t(locale, "today.streak_label")}</span>
              </span>
            ) : undefined
          }
        />

        {hasAnsweredQa && (
          <Link
            href="/qa"
            transitionTypes={["nav-forward"]}
            className="press flex items-center gap-3 rounded-2xl bg-learn/[0.12] px-4 py-3.5"
          >
            <MessageCircleQuestion className="h-5 w-5 shrink-0 text-learn" />
            <span className="flex-1 text-[15px] font-semibold">{t(locale, "today.qa_answered")}</span>
            <span className="text-[15px] font-semibold text-learn">{t(locale, "qa.answered_read")}</span>
          </Link>
        )}

        {/* Rings only for an active account. Unpaid, food and protein cannot
            be logged, so all three would sit at zero — a screen of empty
            rings reads as failure on the first visit, which is the opposite of
            what the free tier is for. */}
        {paid && (
          <Suspense fallback={<RingsSectionSkeleton />}>
            <RingsSection
              locale={locale}
              userId={user!.id}
              training={{ value: weekDone, target: weekTarget }}
            />
          </Suspense>
        )}
      </div>

      <TodayWorkout locale={locale} state={workoutState} day={todayDay} locked={!paid} />

      {/* Independent of everything above, so it never decides when the
          coaching content paints. */}
      <Suspense fallback={<NutritionSectionSkeleton />}>
        <NutritionSection locale={locale} userId={user!.id} />
      </Suspense>

      {/* Write-first cards: an empty check-in and a chart of data an unpaid
          account has none of. Rendering a lock in place of each turned Today
          into a column of padlocks, which is exactly the impression the free
          tier exists to avoid. Unpaid users get the plan they own, then one
          summary at the end. */}
      {paid && (
        <>
          <CheckinCard locale={locale} todayCheckin={todayCheckin} lastWeightKg={lastWeightKg} />
          <ProgressTeaser locale={locale} points={teaserWeights} />
        </>
      )}

      {/* One wall, never two: when a redirect named a specific feature, that
          card replaces the general summary rather than stacking under it. */}
      {!paid &&
        (lockedFeature ? (
          <Locked locale={locale} feature={lockedFeature} appShell={appShell} />
        ) : (
          <UpgradeSummary locale={locale} appShell={appShell} />
        ))}

      <Suspense fallback={<QaSparkSectionSkeleton />}>
        <QaSparkSection locale={locale} />
      </Suspense>
    </div>
  );
}
