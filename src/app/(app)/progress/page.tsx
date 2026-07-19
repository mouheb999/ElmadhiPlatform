import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { pick, t, type StringKey } from "@/lib/i18n";
import { tunisDateKey, tunisDaysAgoKey, tunisWeekKey, tunisWeekStartUtc } from "@/lib/dates";
import { WeightTrendChart, type WeightPoint } from "@/components/progress/weight-trend-chart";
import { WeeklyVolumeChart, type VolumeWeek } from "@/components/progress/weekly-volume-chart";
import { ConsistencyGrid, type ConsistencyWeek } from "@/components/progress/consistency-grid";
import { MuscleProgress, type MuscleRow } from "@/components/progress/muscle-progress";
import { ExerciseTrends, type ExerciseTrend } from "@/components/progress/exercise-trends";

export const dynamic = "force-dynamic";

const WEEKS_SHOWN = 12;

/**
 * The progress dashboard: weight trend, strength (weekly volume + top
 * exercises), consistency, and per-muscle volume. Server-rendered, three
 * indexed queries, all aggregation in TS — no client chart runtime.
 */
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: 30 | 90 = rangeParam === "90" ? 90 : 30;
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 12 Tunis week buckets, oldest first, keyed by their Monday.
  const currentWeekStart = tunisWeekStartUtc();
  const weekKeys: string[] = Array.from({ length: WEEKS_SHOWN }, (_, i) =>
    tunisDateKey(new Date(currentWeekStart.getTime() - (WEEKS_SHOWN - 1 - i) * 7 * 86400000)),
  );
  const windowStartIso = new Date(
    currentWeekStart.getTime() - (WEEKS_SHOWN - 1) * 7 * 86400000,
  ).toISOString();
  const checkinsFrom = tunisDaysAgoKey(89);

  const [{ data: trainingProfile }, { data: checkins }, { data: sessions }] = await Promise.all([
    supabase
      .from("training_profiles")
      .select("days_per_week")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("checkin_date, weight_kg")
      .eq("user_id", user.id)
      .gte("checkin_date", checkinsFrom)
      .order("checkin_date", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .gte("completed_at", windowStartIso),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  type SetRow = {
    session_id: string;
    exercise_id: string;
    weight_kg: number | null;
    reps: number;
    exercises: { primary_muscle: string; name_en: string; name_ar: string | null } | null;
  };
  const { data: setsRaw } = sessionIds.length
    ? await supabase
        .from("workout_sets")
        .select("session_id, exercise_id, weight_kg, reps, exercises(primary_muscle, name_en, name_ar)")
        .in("session_id", sessionIds)
    : { data: [] };
  const sets = (setsRaw ?? []) as unknown as SetRow[];

  // ---- Weight trend ----
  const rangeFrom = tunisDaysAgoKey(range - 1);
  const weightPoints: WeightPoint[] = (checkins ?? [])
    .filter((c) => c.weight_kg !== null && c.checkin_date >= rangeFrom)
    .map((c) => ({ date: c.checkin_date, kg: c.weight_kg! }));

  // ---- Weekly buckets ----
  const weekOfSession = new Map<string, string>();
  for (const s of sessions ?? []) {
    if (s.completed_at) weekOfSession.set(s.id, tunisWeekKey(s.completed_at));
  }
  const volumeByWeek = new Map<string, number>();
  const sessionsByWeek = new Map<string, number>();
  for (const s of sessions ?? []) {
    const wk = weekOfSession.get(s.id);
    if (wk) sessionsByWeek.set(wk, (sessionsByWeek.get(wk) ?? 0) + 1);
  }
  for (const set of sets) {
    const wk = weekOfSession.get(set.session_id);
    if (!wk) continue;
    volumeByWeek.set(wk, (volumeByWeek.get(wk) ?? 0) + (set.weight_kg ?? 0) * set.reps);
  }

  const fmtWeek = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };
  const volumeWeeks: VolumeWeek[] = weekKeys.map((key, i) => ({
    label: fmtWeek(key),
    volumeKg: Math.round(volumeByWeek.get(key) ?? 0),
    isCurrent: i === weekKeys.length - 1,
  }));

  // ---- Consistency ----
  const target = trainingProfile?.days_per_week ?? 0;
  const consistencyWeeks: ConsistencyWeek[] = weekKeys.map((key, i) => ({
    label: fmtWeek(key),
    done: sessionsByWeek.get(key) ?? 0,
    target: Math.max(target, 1),
    isCurrent: i === weekKeys.length - 1,
  }));
  let weekStreak = 0;
  for (let i = weekKeys.length - 1; i >= 0; i--) {
    const done = sessionsByWeek.get(weekKeys[i]) ?? 0;
    if (done >= Math.max(target, 1)) weekStreak += 1;
    else if (i === weekKeys.length - 1) continue; // current week may be mid-flight
    else break;
  }

  // ---- Per-muscle: last 4 weeks vs the 4 before ----
  const recentWeeks = new Set(weekKeys.slice(-4));
  const priorWeeks = new Set(weekKeys.slice(-8, -4));
  const byMuscle = new Map<string, { recent: number; prev: number }>();
  for (const set of sets) {
    const muscle = set.exercises?.primary_muscle;
    const wk = weekOfSession.get(set.session_id);
    if (!muscle || !wk) continue;
    const bucket = byMuscle.get(muscle) ?? { recent: 0, prev: 0 };
    const vol = (set.weight_kg ?? 0) * set.reps;
    if (recentWeeks.has(wk)) bucket.recent += vol;
    else if (priorWeeks.has(wk)) bucket.prev += vol;
    byMuscle.set(muscle, bucket);
  }
  const muscleRows: MuscleRow[] = [...byMuscle.entries()]
    .filter(([, v]) => v.recent > 0 || v.prev > 0)
    .map(([muscle, v]) => ({
      muscle,
      label: t(locale, `muscle.${muscle}` as StringKey),
      recentKg: Math.round(v.recent),
      prevKg: Math.round(v.prev),
    }))
    .sort((a, b) => b.recentKg - a.recentKg);

  // ---- Top exercises: weekly best weight for the 4 most-trained ----
  const setCountByExercise = new Map<string, number>();
  for (const set of sets) {
    if (set.weight_kg === null) continue;
    setCountByExercise.set(set.exercise_id, (setCountByExercise.get(set.exercise_id) ?? 0) + 1);
  }
  const topExerciseIds = [...setCountByExercise.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);
  const exerciseTrends: ExerciseTrend[] = topExerciseIds.map((exerciseId) => {
    const own = sets.filter((s) => s.exercise_id === exerciseId && s.weight_kg !== null);
    const maxByWeek = new Map<string, number>();
    for (const s of own) {
      const wk = weekOfSession.get(s.session_id);
      if (!wk) continue;
      maxByWeek.set(wk, Math.max(maxByWeek.get(wk) ?? 0, s.weight_kg!));
    }
    return {
      exerciseId,
      name: pick(locale, own[0]?.exercises?.name_en, own[0]?.exercises?.name_ar),
      points: weekKeys
        .filter((key) => maxByWeek.has(key))
        .map((key) => ({ label: fmtWeek(key), kg: maxByWeek.get(key)! })),
    };
  });

  const hasAnyData = weightPoints.length > 0 || sessionIds.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "progress.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "progress.subtitle")}</p>
      </div>

      {!hasAnyData && (
        <p className="rounded-2xl border border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
          {t(locale, "progress.empty")}
        </p>
      )}

      <Section
        title={t(locale, "progress.weight_title")}
        action={
          <div className="flex gap-1.5">
            <RangePill href="/progress?range=30" active={range === 30} label={t(locale, "progress.range_30")} />
            <RangePill href="/progress?range=90" active={range === 90} label={t(locale, "progress.range_90")} />
          </div>
        }
      >
        <WeightTrendChart locale={locale} points={weightPoints} />
      </Section>

      <Section title={t(locale, "progress.strength_title")} subtitle={t(locale, "progress.volume_week")}>
        <WeeklyVolumeChart locale={locale} weeks={volumeWeeks} />
      </Section>

      {exerciseTrends.length > 0 && (
        <Section title={t(locale, "progress.top_exercises")}>
          <ExerciseTrends locale={locale} exercises={exerciseTrends} />
        </Section>
      )}

      <Section title={t(locale, "progress.consistency_title")}>
        <ConsistencyGrid locale={locale} weeks={consistencyWeeks} weekStreak={weekStreak} />
      </Section>

      <Section title={t(locale, "progress.muscles_title")} subtitle={t(locale, "progress.muscles_sub")}>
        <MuscleProgress locale={locale} rows={muscleRows} />
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RangePill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-accent px-3 py-1 text-xs font-bold text-bg"
          : "rounded-full border border-hairline px-3 py-1 text-xs font-bold text-muted hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
