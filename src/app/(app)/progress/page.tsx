import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { pick, t, type StringKey } from "@/lib/i18n";
import { tunisDateKey, tunisDaysAgoKey, tunisWeekKey, tunisWeekStartUtc } from "@/lib/dates";
import { WeightTrendChart, shortDate, type WeightPoint } from "@/components/progress/weight-trend-chart";
import { WeeklyBars } from "@/components/progress/weekly-bars";
import { MuscleProgress, type MuscleRow } from "@/components/progress/muscle-progress";
import { ExerciseTrends, type ExerciseTrend } from "@/components/progress/exercise-trends";
import { JourneyCard } from "@/components/progress/journey-card";
import { loadJourney } from "@/lib/journey";
import { PageHeader } from "@/components/shared/page-header";
import { chipClass } from "@/components/ui/chip";

export const dynamic = "force-dynamic";

const WEEKS_SHOWN = 12;

const fmt = new Intl.NumberFormat("en-US");

/**
 * The progress screen, built to be read by someone who is not a coach.
 *
 * Every card follows one pattern: a title, the number that answers it in
 * large type and in its colour, one sentence saying what that number means
 * in words, then the chart for anyone who wants the history, with a line
 * explaining how to read it. Nothing is left as a bare figure.
 *
 * Ordered by how often each should change what you do: did I train enough,
 * where is my weight going, am I doing more work, am I getting stronger, and
 * what am I training.
 *
 * Server-rendered, three indexed queries, all aggregation in TS — no client
 * chart runtime.
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
  const user = await getCurrentUser();
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

  const [journey, { data: trainingProfile }, { data: checkins }, { data: sessions }] = await Promise.all([
    // The plan they were shown on /start, anchored to the day they began.
    loadJourney(supabase, user.id),
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
  const weekLabel = (key: string) => shortDate(locale, key);
  const last = weekKeys.length - 1;

  // ---- Workouts per week ----
  const target = trainingProfile?.days_per_week ?? 0;
  const sessionWeeks = weekKeys.map((key) => ({ label: weekLabel(key), value: sessionsByWeek.get(key) ?? 0 }));
  const sessionsNow = sessionWeeks[last].value;
  // "Goal met in X of the last N weeks" counts only finished weeks, and only
  // from the first week anything was logged — a member who joined three weeks
  // ago is not marked down for the nine weeks before they existed.
  const firstActive = sessionWeeks.findIndex((w) => w.value > 0);
  const finishedWeeks = firstActive === -1 || firstActive >= last ? [] : sessionWeeks.slice(firstActive, last);
  const weeksHit = target > 0 ? finishedWeeks.filter((w) => w.value >= target).length : 0;
  let weekStreak = 0;
  for (let i = last; i >= 0; i--) {
    const done = sessionWeeks[i].value;
    if (target > 0 && done >= target) weekStreak += 1;
    else if (i === last) continue; // this week may still be under way
    else break;
  }

  // ---- Total weight lifted ----
  const volumeWeeks = weekKeys.map((key) => ({
    label: weekLabel(key),
    value: Math.round(volumeByWeek.get(key) ?? 0),
  }));
  const volumeNow = volumeWeeks[last].value;
  const volumeLastWeek = volumeWeeks[last - 1]?.value ?? 0;
  const volumeBest = Math.max(...volumeWeeks.map((w) => w.value));
  const compactKg = (n: number) =>
    n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  // ---- Sets per muscle: last 4 weeks vs the 4 before ----
  const recentWeeks = new Set(weekKeys.slice(-4));
  const priorWeeks = new Set(weekKeys.slice(-8, -4));
  const byMuscle = new Map<string, { recent: number; prev: number }>();
  for (const set of sets) {
    const muscle = set.exercises?.primary_muscle;
    const wk = weekOfSession.get(set.session_id);
    if (!muscle || !wk) continue;
    const bucket = byMuscle.get(muscle) ?? { recent: 0, prev: 0 };
    if (recentWeeks.has(wk)) bucket.recent += 1;
    else if (priorWeeks.has(wk)) bucket.prev += 1;
    byMuscle.set(muscle, bucket);
  }
  const muscleRows: MuscleRow[] = [...byMuscle.entries()]
    .filter(([, v]) => v.recent > 0)
    .map(([muscle, v]) => ({
      muscle,
      label: t(locale, `muscle.${muscle}` as StringKey),
      recentSets: v.recent,
      prevSets: v.prev,
    }))
    .sort((a, b) => b.recentSets - a.recentSets);

  // ---- Heaviest lifts: weekly best weight for the 4 most-trained ----
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
        .map((key) => ({ label: weekLabel(key), kg: maxByWeek.get(key)! })),
    };
  });

  // ---- Weight headline ----
  const kg = t(locale, "session.kg");
  const latestWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].kg : null;
  let weightSentence: string | null = null;
  if (weightPoints.length >= 2) {
    const change = Math.round((weightPoints[weightPoints.length - 1].kg - weightPoints[0].kg) * 10) / 10;
    const since = shortDate(locale, weightPoints[0].date);
    const key: StringKey =
      Math.abs(change) < 0.3 ? "progress.weight_steady" : change < 0 ? "progress.weight_down" : "progress.weight_up";
    weightSentence = t(locale, key).replace("{n}", Math.abs(change).toFixed(1)).replace("{date}", since);
  }

  const hasAnyData = weightPoints.length > 0 || sessionIds.length > 0;

  // The newest weigh-in in the last 90 days, whatever range the chart is on.
  const weighIns = (checkins ?? []).filter((c) => c.weight_kg !== null);
  const newestKg = weighIns.length > 0 ? weighIns[weighIns.length - 1].weight_kg : null;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageHeader eyebrow={t(locale, "progress.eyebrow")} title={t(locale, "progress.title")} />

      {/* The plan, first and loud. Everything under it is the detail. */}
      {journey && <JourneyCard locale={locale} journey={journey} latestKg={newestKg} />}

      {!hasAnyData && !journey && (
        <p className="card-surface px-5 py-6 text-center text-[15px] text-muted">{t(locale, "progress.empty")}</p>
      )}

      {/* Five charts used to be stacked open under the header, each a screen
          tall. They are the record, not the headline, so each is now one row —
          its title and its number — and opens when somebody wants the chart. */}
      <h2 className="-mb-2 mt-1 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
        {t(locale, "progress.details")}
      </h2>

      {/* 1. Did I train enough? */}
      <Card
        title={t(locale, "progress.per_week_title")}
        figure={target > 0 ? `${sessionsNow}/${target}` : String(sessionsNow)}
        tone="text-train"
        trailing={
          weekStreak > 1 ? (
            <span className="flex items-center gap-1 text-[13px] font-semibold text-train">
              <Flame className="h-4 w-4" />
              <span className="font-num">{weekStreak}</span> {t(locale, "progress.week_streak")}
            </span>
          ) : undefined
        }
      >
        <Headline
          tone="text-train"
          value={target > 0 ? `${sessionsNow}/${target}` : String(sessionsNow)}
          unit={t(locale, "progress.sessions_label")}
          sentence={
            finishedWeeks.length > 0 && target > 0
              ? t(locale, "progress.goal_met")
                  .replace("{hit}", String(weeksHit))
                  .replace("{n}", String(finishedWeeks.length))
              : t(locale, "progress.first_week")
          }
        />
        <WeeklyBars
          weeks={sessionWeeks}
          colour="var(--train)"
          target={target > 0 ? target : undefined}
          targetLabel={t(locale, "progress.goal_line")}
          nowLabel={t(locale, "progress.now_short")}
          labelAll
          ariaLabel={t(locale, "progress.per_week_title")}
        />
        <Explain>{t(locale, "progress.per_week_explain")}</Explain>
      </Card>

      {/* 2. Where is my weight going? */}
      <Card
        title={t(locale, "progress.weight_title")}
        figure={latestWeight !== null ? `${latestWeight.toFixed(1)} ${kg}` : undefined}
        tone="text-body"
        trailing={
          <div className="flex gap-1.5">
            <Link href="/progress?range=30" scroll={false} className={chipClass(range === 30, "sm")}>
              {t(locale, "progress.range_30")}
            </Link>
            <Link href="/progress?range=90" scroll={false} className={chipClass(range === 90, "sm")}>
              {t(locale, "progress.range_90")}
            </Link>
          </div>
        }
      >
        {latestWeight !== null && (
          <Headline tone="text-body" value={latestWeight.toFixed(1)} unit={kg} sentence={weightSentence} />
        )}
        <WeightTrendChart locale={locale} points={weightPoints} />
        {weightPoints.length >= 2 && <Explain>{t(locale, "progress.weight_explain")}</Explain>}
      </Card>

      {/* 3. Am I doing more work? */}
      <Card
        title={t(locale, "progress.volume_title")}
        figure={volumeBest > 0 ? `${compactKg(volumeNow)} ${kg}` : undefined}
        tone="text-train"
      >
        {volumeBest > 0 ? (
          <>
            <Headline
              tone="text-train"
              value={fmt.format(volumeNow)}
              unit={kg}
              caption={t(locale, "progress.so_far")}
              sentence={[
                volumeLastWeek > 0
                  ? t(locale, "progress.last_week_n").replace("{n}", fmt.format(volumeLastWeek))
                  : null,
                // Only when it is a different week from both figures already
                // shown; otherwise it repeats one of them.
                volumeBest > Math.max(volumeNow, volumeLastWeek)
                  ? t(locale, "progress.best_week_n").replace("{n}", fmt.format(volumeBest))
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <WeeklyBars
              weeks={volumeWeeks}
              colour="var(--train)"
              nowLabel={t(locale, "progress.now_short")}
              format={compactKg}
              ariaLabel={t(locale, "progress.volume_title")}
            />
            <Explain>{t(locale, "progress.volume_explain")}</Explain>
          </>
        ) : (
          <p className="py-4 text-center text-[15px] text-muted">{t(locale, "progress.empty_strength")}</p>
        )}
      </Card>

      {/* 4. Am I getting stronger? */}
      {exerciseTrends.length > 0 && (
        <Card title={t(locale, "progress.lifts_title")}>
          <Explain>{t(locale, "progress.lifts_explain")}</Explain>
          <ExerciseTrends locale={locale} exercises={exerciseTrends} />
        </Card>
      )}

      {/* 5. What am I training? */}
      <Card title={t(locale, "progress.sets_title")}>
        <Explain>{t(locale, "progress.sets_explain")}</Explain>
        <MuscleProgress locale={locale} rows={muscleRows} />
      </Card>
    </div>
  );
}

/**
 * A Progress row: closed, it is a title and the figure that answers it; open,
 * it is the chart and the sentence that explains it.
 *
 * A native <details>, so it needs no client code and the open state survives
 * the range links inside the weight card re-rendering the page.
 */
function Card({
  title,
  figure,
  tone,
  trailing,
  children,
}: {
  title: string;
  /** The one number shown while the row is closed. */
  figure?: string;
  /** Its colour class, matching the chart inside. */
  tone?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details aria-label={title} className="card-surface group">
      <summary className="press flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-[16px] font-bold text-ink">{title}</span>
        <span className="flex items-center gap-2.5">
          {figure && (
            <span className={`font-num text-[17px] font-bold ${tone ?? "text-ink"}`}>
              <bdi>{figure}</bdi>
            </span>
          )}
          <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5 pt-1">
        {trailing && <div className="flex justify-end">{trailing}</div>}
        {children}
      </div>
    </details>
  );
}

/**
 * The answer to a card's question: the figure large and in its colour, its
 * unit in small capitals, an optional caption beside it, and one sentence
 * underneath that says what it means.
 */
function Headline({
  tone,
  value,
  unit,
  caption,
  sentence,
}: {
  tone: string;
  value: string;
  unit: string;
  caption?: string;
  sentence?: string | null;
}) {
  return (
    <div className="-mt-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`flex items-baseline gap-1 ${tone}`}>
          <span className="font-num text-[34px] font-bold leading-none">{value}</span>
          <span className="text-[15px] font-bold uppercase">{unit}</span>
        </span>
        {caption && <span className="text-[15px] text-muted">{caption}</span>}
      </div>
      {sentence && <p className="mt-1.5 text-[15px] font-medium text-ink">{sentence}</p>}
    </div>
  );
}

/** How to read the chart, in one plain sentence. */
function Explain({ children }: { children: React.ReactNode }) {
  return <p className="-mt-1 text-[13px] leading-snug text-muted">{children}</p>;
}
