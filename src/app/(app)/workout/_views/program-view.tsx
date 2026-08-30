import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { type Locale } from "@/lib/i18n";
import { hasPaidAccess } from "@/lib/subscription-server";
import { ProgramEditor, type DayStatus, type EditorDay } from "@/components/workout/program-editor";
import { tunisWeekStartUtc } from "@/lib/dates";
import { filterSafeExercises, type ExerciseRow } from "@/lib/algorithms/exercise-substitution";
import { resolveEquipmentValues } from "@/lib/algorithms/split-fill";
import { LoadFailure } from "@/components/shared/load-failure";

/**
 * The program screen's body, suspended by /workout so the tab bar and the
 * skeleton are on screen before any of this runs.
 *
 * It used to be the whole of /workout/program, awaiting eight queries in a row:
 * profile -> program -> days -> catalog -> sessions -> sets/events -> equipment
 * rule -> paywall. Every one of those was a round-trip to eu-central-1 with the
 * next one queued behind it, and nothing rendered until the last returned. That
 * is the difference the user felt between this tab and /diet, which resolves
 * its shell in one query and streams the rest.
 *
 * It is now two waves:
 *
 *   wave 1  everything that depends only on the user — the program (joined to
 *           its profile rather than fetched after it), the exercise catalog,
 *           the equipment map, the paywall answer, the open session, and this
 *           week's finished sessions.
 *   wave 2  the two reads that need an id from wave 1 — the program's days,
 *           and the sets/events belonging to those finished sessions.
 *
 * Two things made the collapse possible:
 *
 *   - `user_programs` is joined to `training_profiles!inner`, so "the active
 *     program of this user's active profile" is one query rather than two.
 *   - the week's finished sessions are read for the USER, not for this
 *     program's day ids. It is the same set of rows in practice (a user has one
 *     active program) and anything else falls out when `dayStatus` is keyed by
 *     day id below — but it no longer has to wait for the days query.
 */
export async function ProgramView({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const weekStartIso = tunisWeekStartUtc().toISOString();

  // Request-deduped: the layout and the page above have already verified this
  // token, so asking again costs nothing.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const userId = user.id;

  type ProgramRow = {
    id: string;
    training_profiles: {
      id: string;
      injuries: string[] | null;
      experience: string;
      location: string | null;
      equipment_gym: string[] | null;
      equipment_home: string[] | null;
    };
  };

  // ---- Wave 1: everything that needs only the user id ----
  const [
    { data: programRaw },
    { data: allExercisesRaw, error: exercisesError },
    { data: equipmentRule },
    locked,
    { data: openSession },
    { data: weekSessions },
  ] = await Promise.all([
    supabase
      .from("user_programs")
      .select(
        "id, training_profiles!inner(id, user_id, is_active, injuries, experience, location, equipment_gym, equipment_home)",
      )
      .eq("is_active", true)
      .eq("training_profiles.user_id", userId)
      .eq("training_profiles.is_active", true)
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name_en, name_ar, primary_muscle, equipment, substitution_group, contraindicated_for, difficulty")
      // Strength only. The catalog also holds cardio and stretching rows, and
      // until now both were offered in the "add an exercise" picker — you could
      // put Child's Pose in your program with 3 sets of 8-12. Cardio has its
      // own block (migration 051) and stretching is not a programmed lift.
      .eq("exercise_type", "strength"),
    supabase
      .from("questionnaire_rules")
      .select("payload")
      .eq("key", "equipment_option_map")
      .maybeSingle(),
    // Already request-deduped with the layout's read of the same row.
    hasPaidAccess().then((paid) => !paid),
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id")
      .eq("user_id", userId)
      .is("completed_at", null)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id, started_at, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gte("completed_at", weekStartIso),
  ]);

  const program = programRaw as unknown as ProgramRow | null;
  // No profile or no program yet — the questionnaire is the only way forward.
  if (!program) redirect("/workout/questions");
  const trainingProfile = program.training_profiles;

  type DayRow = {
    id: string;
    day_number: number;
    day_name: string;
    /** Zero or one row — `user_program_day_id` is UNIQUE (migration 051). */
    user_program_cardio: { minutes: number }[] | { minutes: number } | null;
    user_program_exercises: {
      id: string;
      exercise_id: string;
      sets: number;
      rep_range: string;
      rest_seconds: number | null;
      notes: string | null;
      exercises: {
        id: string;
        name_en: string;
        name_ar: string | null;
        primary_muscle: string;
        equipment: string;
        substitution_group: string | null;
        contraindicated_for: string[] | null;
        difficulty: string | null;
        thumbnail_url: string | null;
        video_url: string | null;
      } | null;
    }[];
  };

  const doneSessions = weekSessions ?? [];
  const doneSessionIds = doneSessions.map((s) => s.id);

  // ---- Wave 2: the reads that needed an id from wave 1 ----
  // The cardio block rides along on the days query rather than costing a third
  // wave — it hangs off the same day row and is one small embed.
  const [
    { data: dayRowsRaw, error: dayRowsError },
    { data: doneSets },
    { data: doneEvents },
    { data: doneCardio },
  ] = await Promise.all([
      supabase
        .from("user_program_days")
        .select(
          "id, day_number, day_name, user_program_cardio(minutes), user_program_exercises(id, exercise_id, sets, rep_range, rest_seconds, notes, exercises(id, name_en, name_ar, primary_muscle, equipment, substitution_group, contraindicated_for, difficulty, thumbnail_url, video_url))",
        )
        .eq("user_program_id", program.id)
        .order("day_number", { ascending: true }),
      doneSessionIds.length
        ? supabase.from("workout_sets").select("session_id, weight_kg, reps").in("session_id", doneSessionIds)
        : Promise.resolve({ data: [] as { session_id: string; weight_kg: number | null; reps: number }[] }),
      doneSessionIds.length
        ? supabase
            .from("events")
            .select("payload")
            .eq("user_id", userId)
            .eq("event_type", "session_completed")
            .in("payload->>session_id", doneSessionIds)
        : Promise.resolve({ data: [] as { payload: unknown }[] }),
      doneSessionIds.length
        ? supabase
            .from("workout_cardio_logs")
            .select("session_id, minutes, calories_burned")
            .in("session_id", doneSessionIds)
        : Promise.resolve({
            data: [] as { session_id: string; minutes: number; calories_burned: number }[],
          }),
    ]);

  // A schema mismatch (e.g. a pending migration) makes Postgrest reject the
  // whole query. Surface that clearly instead of silently rendering an empty
  // program, which the validator would otherwise misreport as "no exercises
  // in any muscle group."
  if (dayRowsError || exercisesError) {
    return <LoadFailure detail={dayRowsError?.message ?? exercisesError?.message} />;
  }

  const dayRows = (dayRowsRaw ?? []) as unknown as DayRow[];

  // ---- Weekly gating: which days are done (locked) or in progress? ----
  const prCountBySession = new Map<string, number>();
  for (const e of doneEvents ?? []) {
    const payload = ((e as { payload?: unknown }).payload ?? {}) as {
      session_id?: string;
      pr_exercise_ids?: string[];
    };
    if (payload.session_id) {
      prCountBySession.set(payload.session_id, (payload.pr_exercise_ids ?? []).length);
    }
  }

  const cardioBySession = new Map<string, { minutes: number; caloriesBurned: number }>();
  for (const c of doneCardio ?? []) {
    cardioBySession.set(c.session_id, { minutes: c.minutes, caloriesBurned: c.calories_burned });
  }

  const setsBySession = new Map<string, { weight_kg: number | null; reps: number }[]>();
  for (const s of doneSets ?? []) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  // Keyed by day id, so a finished session belonging to a previous program
  // simply never matches a tab and is ignored.
  const dayStatus: Record<string, DayStatus> = {};
  for (const session of doneSessions) {
    if (!session.user_program_day_id) continue;
    const sets = setsBySession.get(session.id) ?? [];
    dayStatus[session.user_program_day_id] = {
      state: "completed",
      stats: {
        setCount: sets.length,
        volumeKg: Math.round(sets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * s.reps, 0)),
        minutes:
          session.completed_at && session.started_at
            ? Math.max(
                1,
                Math.round(
                  (Date.parse(session.completed_at) - Date.parse(session.started_at)) / 60000,
                ),
              )
            : 0,
        prCount: prCountBySession.get(session.id) ?? 0,
      },
      cardio: cardioBySession.get(session.id) ?? null,
    };
  }
  if (openSession?.user_program_day_id && !dayStatus[openSession.user_program_day_id]) {
    dayStatus[openSession.user_program_day_id] = { state: "in_progress" };
  }

  const allExercises = (allExercisesRaw ?? []) as (ExerciseRow & {
    name_en: string;
    name_ar: string | null;
  })[];
  // The swap picker must offer the same equipment the generator used, so it
  // resolves location + the two equipment multi-selects through the same map.
  const safePool = filterSafeExercises(allExercises, {
    injuries: trainingProfile.injuries ?? [],
    equipment: resolveEquipmentValues(
      {
        location: trainingProfile.location ?? undefined,
        equipment_gym: trainingProfile.equipment_gym ?? [],
        equipment_home: trainingProfile.equipment_home ?? [],
      },
      (equipmentRule?.payload ?? {}) as Record<string, string>,
    ),
  });
  const exerciseById = new Map(allExercises.map((e) => [e.id, e]));

  const days: EditorDay[] = dayRows.map((day) => ({
    id: day.id,
    dayNumber: day.day_number,
    dayName: day.day_name,
    cardio: readCardio(day.user_program_cardio),
    exercises: (day.user_program_exercises ?? [])
      .filter((row) => row.exercises)
      .map((row) => {
        const ex = row.exercises!;
        const substitutes = safePool
          .filter(
            (c) =>
              c.id !== ex.id &&
              (ex.substitution_group
                ? c.substitution_group === ex.substitution_group
                : c.primary_muscle === ex.primary_muscle),
          )
          .slice(0, 4)
          .map((c) => {
            const full = exerciseById.get(c.id)!;
            return { id: full.id, nameEn: full.name_en, nameAr: full.name_ar };
          });
        return {
          id: row.id,
          exerciseId: ex.id,
          nameEn: ex.name_en,
          nameAr: ex.name_ar,
          primaryMuscle: ex.primary_muscle,
          sets: row.sets,
          repRange: row.rep_range,
          restSeconds: row.rest_seconds ?? 90,
          notes: row.notes,
          thumbnailUrl: ex.thumbnail_url,
          videoUrl: ex.video_url,
          substitutes,
        };
      }),
  }));

  // The full catalog backs the "add an exercise" picker, which is a different
  // question from the swap list: swapping stays inside the safety filter (same
  // muscle, equipment they have, nothing their injury rules out), but adding is
  // the user saying what they want in their own program. Filtering that down to
  // four suggestions would be the generator overruling a deliberate choice.
  const catalog = allExercises.map((e) => ({
    id: e.id,
    nameEn: e.name_en,
    nameAr: e.name_ar,
    primaryMuscle: e.primary_muscle,
    equipment: e.equipment,
  }));

  return (
    <ProgramEditor
      locale={locale}
      programId={program.id}
      initialDays={days}
      dayStatus={dayStatus}
      catalog={catalog}
      experience={trainingProfile.experience}
      locked={locked}
    />
  );
}

/**
 * A UNIQUE one-to-one embed comes back as an object on some PostgREST versions
 * and a one-element array on others, depending on how the relationship is
 * detected. Read both rather than betting on one.
 */
function readCardio(
  raw: { minutes: number }[] | { minutes: number } | null | undefined,
): { minutes: number } | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row ? { minutes: row.minutes } : null;
}
