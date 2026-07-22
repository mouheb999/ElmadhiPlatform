import { notFound, redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { tunisWeekStartUtc } from "@/lib/dates";
import { suggestNextWeight, type HistorySet } from "@/lib/algorithms/progression";
import {
  SessionClient,
  type InitialSession,
  type ServerSet,
  type SessionExercise,
} from "@/components/workout/session-client";
import { SessionLockedCard } from "@/components/workout/session-locked-card";
import { SessionElsewhereCard } from "@/components/workout/session-elsewhere-card";

export const dynamic = "force-dynamic";

/**
 * Workout Session Mode: turns a program day into a live, loggable session.
 *
 * The session is server-backed (018): an open workout_sessions row exists
 * while training, sets save one-by-one and lock, and a day completed this
 * Tunis week renders as a locked stats card instead of the logging UI.
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
      notes: string | null;
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

  const weekStartIso = tunisWeekStartUtc().toISOString();

  const [{ data: dayRaw }, { data: openSession }, { data: weekDone }] = await Promise.all([
    supabase
      .from("user_program_days")
      .select(
        "id, day_name, user_programs!inner(user_id), user_program_exercises(id, exercise_id, sets, rep_range, rest_seconds, order_index, notes, exercises(id, name_en, name_ar, equipment, thumbnail_url, video_url))",
      )
      .eq("id", dayId)
      .eq("user_programs.user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id, started_at, skipped_exercise_ids")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, started_at, completed_at")
      .eq("user_id", user.id)
      .eq("user_program_day_id", dayId)
      .not("completed_at", "is", null)
      .gte("completed_at", weekStartIso)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!dayRaw) notFound();

  const day = dayRaw as unknown as DayRow;

  // ---- Weekly lock: this day is done — show its stats, no logging UI ----
  if (weekDone) {
    const [{ data: doneSets }, { data: doneEvent }] = await Promise.all([
      supabase.from("workout_sets").select("weight_kg, reps").eq("session_id", weekDone.id),
      supabase
        .from("events")
        .select("payload")
        .eq("user_id", user.id)
        .eq("event_type", "session_completed")
        .eq("payload->>session_id", weekDone.id)
        .limit(1)
        .maybeSingle(),
    ]);
    const volumeKg = Math.round(
      (doneSets ?? []).reduce((sum, s) => sum + (s.weight_kg ?? 0) * s.reps, 0),
    );
    const minutes =
      weekDone.completed_at && weekDone.started_at
        ? Math.max(
            1,
            Math.round(
              (Date.parse(weekDone.completed_at) - Date.parse(weekDone.started_at)) / 60000,
            ),
          )
        : 0;
    const payload = (doneEvent?.payload ?? {}) as { pr_exercise_ids?: string[] };
    return (
      <SessionLockedCard
        locale={locale}
        dayName={day.day_name}
        stats={{
          setCount: (doneSets ?? []).length,
          volumeKg,
          minutes,
          prCount: (payload.pr_exercise_ids ?? []).length,
        }}
      />
    );
  }

  // ---- A session for ANOTHER day is open: one workout at a time ----
  if (openSession && openSession.user_program_day_id !== dayId) {
    const [{ data: openDay }, { count: openSetCount }] = await Promise.all([
      supabase
        .from("user_program_days")
        .select("id, day_name")
        .eq("id", openSession.user_program_day_id!)
        .maybeSingle(),
      supabase
        .from("workout_sets")
        .select("id", { count: "exact", head: true })
        .eq("session_id", openSession.id),
    ]);
    const startedAgo = openSession.started_at
      ? formatDistanceToNow(new Date(openSession.started_at), {
          locale: locale === "tn" ? ar : undefined,
        })
      : "";
    return (
      <SessionElsewhereCard
        locale={locale}
        openDayId={openSession.user_program_day_id!}
        openDayName={openDay?.day_name ?? ""}
        openSessionId={openSession.id}
        startedAgo={startedAgo}
        canDiscard={
          (openSetCount ?? 0) === 0 && (openSession.skipped_exercise_ids ?? []).length === 0
        }
      />
    );
  }

  const rows = (day.user_program_exercises ?? [])
    .filter((r) => r.exercises)
    .sort((a, b) => a.order_index - b.order_index);

  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];

  // ---- Resume payload: sets already stored for this day's open session ----
  let initialSession: InitialSession | null = null;
  if (openSession) {
    type OpenSetRow = {
      user_program_exercise_id: string | null;
      exercise_id: string;
      set_number: number;
      weight_kg: number | null;
      reps: number;
      rir: number | null;
      created_at: string;
      exercises: { name_en: string; name_ar: string | null } | null;
    };
    const { data: openSetsRaw } = await supabase
      .from("workout_sets")
      .select(
        "user_program_exercise_id, exercise_id, set_number, weight_kg, reps, rir, created_at, exercises(name_en, name_ar)",
      )
      .eq("session_id", openSession.id)
      .order("created_at", { ascending: true });
    const openSets = (openSetsRaw ?? []) as unknown as OpenSetRow[];
    const sets: ServerSet[] = openSets.map((s) => ({
      userProgramExerciseId: s.user_program_exercise_id,
      exerciseId: s.exercise_id,
      setNumber: s.set_number,
      weightKg: s.weight_kg,
      reps: s.reps,
      rir: s.rir,
      nameEn: s.exercises?.name_en ?? "",
      nameAr: s.exercises?.name_ar ?? null,
    }));
    initialSession = {
      sessionId: openSession.id,
      startedAt: openSession.started_at ?? new Date().toISOString(),
      skippedExerciseIds: openSession.skipped_exercise_ids ?? [],
      sets,
      lastSetAt: openSets.length > 0 ? openSets[openSets.length - 1].created_at : null,
    };
  }

  // History for prefill + PR detection + progression: most recent first.
  // The open session's own sets are excluded — they'd pollute "last time",
  // the all-time max and the progression suggestion mid-workout.
  type HistorySetRow = {
    exercise_id: string;
    session_id: string;
    weight_kg: number | null;
    reps: number;
    rir: number | null;
  };
  let historyQuery = exerciseIds.length
    ? supabase
        .from("workout_sets")
        .select("exercise_id, session_id, weight_kg, reps, rir, created_at, workout_sessions!inner(user_id)")
        .eq("workout_sessions.user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .limit(500)
    : null;
  if (historyQuery && openSession) {
    historyQuery = historyQuery.neq("session_id", openSession.id);
  }
  const { data: historyRaw } = historyQuery ? await historyQuery : { data: [] };
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
      notes: r.notes,
    };
  });

  return (
    <SessionClient
      locale={locale}
      dayId={day.id}
      dayName={day.day_name}
      exercises={exercises}
      initialSession={initialSession}
    />
  );
}
