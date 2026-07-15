import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { suggestNextWeight, type HistorySet } from "@/lib/algorithms/progression";
import { SessionClient, type SessionExercise } from "@/components/workout/session-client";

export const dynamic = "force-dynamic";

/**
 * Workout Session Mode: turns a program day into a live, loggable session.
 * The server provides the day's exercises plus each exercise's last-session
 * numbers and all-time max weight (for prefills + PR detection); everything
 * during the workout happens client-side (localStorage draft), synced in one
 * write on finish.
 */
export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type DayRow = {
    id: string;
    day_name: string;
    user_program_exercises: {
      id: string;
      exercise_id: string;
      sets: number;
      rep_range: string;
      rest_seconds: number | null;
      order_index: number;
      exercises: {
        id: string;
        name_en: string;
        name_ar: string | null;
        equipment: string;
        thumbnail_url: string | null;
        video_url: string | null;
      } | null;
    }[];
  };

  const { data: dayRaw } = await supabase
    .from("user_program_days")
    .select(
      "id, day_name, user_programs!inner(user_id), user_program_exercises(id, exercise_id, sets, rep_range, rest_seconds, order_index, exercises(id, name_en, name_ar, equipment, thumbnail_url, video_url))",
    )
    .eq("id", dayId)
    .eq("user_programs.user_id", user.id)
    .maybeSingle();
  if (!dayRaw) notFound();

  const day = dayRaw as unknown as DayRow;
  const rows = (day.user_program_exercises ?? [])
    .filter((r) => r.exercises)
    .sort((a, b) => a.order_index - b.order_index);

  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];

  // History for prefill + PR detection + progression: most recent first.
  type HistorySetRow = {
    exercise_id: string;
    session_id: string;
    weight_kg: number | null;
    reps: number;
    rir: number | null;
  };
  const { data: historyRaw } = exerciseIds.length
    ? await supabase
        .from("workout_sets")
        .select("exercise_id, session_id, weight_kg, reps, rir, created_at, workout_sessions!inner(user_id)")
        .eq("workout_sessions.user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const history = (historyRaw ?? []) as unknown as HistorySetRow[];

  const lastByExercise = new Map<string, { weightKg: number | null; reps: number }>();
  const maxByExercise = new Map<string, number>();
  // Per exercise: sets grouped by session, sessions in most-recent-first
  // order (history is already sorted desc, so first-seen session = latest).
  const sessionsByExercise = new Map<string, Map<string, HistorySet[]>>();
  for (const set of history) {
    if (!lastByExercise.has(set.exercise_id)) {
      lastByExercise.set(set.exercise_id, { weightKg: set.weight_kg, reps: set.reps });
    }
    if (set.weight_kg !== null) {
      const max = maxByExercise.get(set.exercise_id) ?? 0;
      if (set.weight_kg > max) maxByExercise.set(set.exercise_id, set.weight_kg);
    }
    let bySession = sessionsByExercise.get(set.exercise_id);
    if (!bySession) {
      bySession = new Map();
      sessionsByExercise.set(set.exercise_id, bySession);
    }
    const sets = bySession.get(set.session_id) ?? [];
    sets.push({ weightKg: set.weight_kg, reps: set.reps, rir: set.rir });
    bySession.set(set.session_id, sets);
  }

  // Was this day already completed today? (Informational, re-training allowed.)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySession } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("user_program_day_id", dayId)
    .not("completed_at", "is", null)
    .gte("completed_at", todayStart.toISOString())
    .limit(1)
    .maybeSingle();

  const exercises: SessionExercise[] = rows.map((r) => {
    const sessionGroups = [...(sessionsByExercise.get(r.exercise_id)?.values() ?? [])].slice(0, 3);
    const suggestion = suggestNextWeight(r.rep_range, sessionGroups);
    return {
      rowId: r.id,
      exerciseId: r.exercise_id,
      nameEn: r.exercises!.name_en,
      nameAr: r.exercises!.name_ar,
      equipment: r.exercises!.equipment,
      targetSets: r.sets,
      repRange: r.rep_range,
      restSeconds: r.rest_seconds ?? 90,
      lastWeightKg: lastByExercise.get(r.exercise_id)?.weightKg ?? null,
      lastReps: lastByExercise.get(r.exercise_id)?.reps ?? null,
      maxWeightKg: maxByExercise.get(r.exercise_id) ?? null,
      suggestedWeightKg: suggestion?.weightKg ?? null,
      suggestionReasonKey: suggestion?.reasonKey ?? null,
      thumbnailUrl: r.exercises!.thumbnail_url,
      videoUrl: r.exercises!.video_url,
    };
  });

  return (
    <SessionClient
      locale={locale}
      dayId={day.id}
      dayName={day.day_name}
      exercises={exercises}
      completedToday={!!todaySession}
    />
  );
}
