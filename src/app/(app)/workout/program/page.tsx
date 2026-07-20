import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { ProgramEditor, type DayStatus, type EditorDay } from "@/components/workout/program-editor";
import { tunisWeekStartUtc } from "@/lib/dates";
import { filterSafeExercises, type ExerciseRow } from "@/lib/algorithms/exercise-substitution";
import { resolveEquipmentValues } from "@/lib/algorithms/split-fill";
import { LoadFailure } from "@/components/shared/load-failure";

export const dynamic = "force-dynamic";

export default async function WorkoutProgramPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id, injuries, experience, location, equipment_gym, equipment_home")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!trainingProfile) redirect("/workout/questions");

  const { data: program } = await supabase
    .from("user_programs")
    .select("id")
    .eq("training_profile_id", trainingProfile.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!program) redirect("/workout/questions");

  type DayRow = {
    id: string;
    day_number: number;
    day_name: string;
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

  const { data: dayRowsRaw, error: dayRowsError } = await supabase
    .from("user_program_days")
    .select(
      "id, day_number, day_name, user_program_exercises(id, exercise_id, sets, rep_range, rest_seconds, notes, exercises(id, name_en, name_ar, primary_muscle, equipment, substitution_group, contraindicated_for, difficulty, thumbnail_url, video_url))",
    )
    .eq("user_program_id", program.id)
    .order("day_number", { ascending: true });

  const { data: allExercisesRaw, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, name_en, name_ar, primary_muscle, equipment, substitution_group, contraindicated_for, difficulty");

  // A schema mismatch (e.g. a pending migration) makes Postgrest reject the
  // whole query. Surface that clearly instead of silently rendering an empty
  // program, which the validator would otherwise misreport as "no exercises
  // in any muscle group."
  if (dayRowsError || exercisesError) {
    return <LoadFailure detail={dayRowsError?.message ?? exercisesError?.message} />;
  }

  const dayRows = (dayRowsRaw ?? []) as unknown as DayRow[];

  // ---- Weekly gating: which days are done (locked) or in progress? ----
  const dayIds = dayRows.map((d) => d.id);
  const weekStartIso = tunisWeekStartUtc().toISOString();
  const [{ data: openSession }, { data: weekSessions }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, user_program_day_id")
      .eq("user_id", user!.id)
      .is("completed_at", null)
      .maybeSingle(),
    dayIds.length
      ? supabase
          .from("workout_sessions")
          .select("id, user_program_day_id, started_at, completed_at")
          .eq("user_id", user!.id)
          .in("user_program_day_id", dayIds)
          .not("completed_at", "is", null)
          .gte("completed_at", weekStartIso)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const doneSessions = weekSessions ?? [];
  const doneSessionIds = doneSessions.map((s) => s.id);
  const [{ data: doneSets }, { data: doneEvents }] = doneSessionIds.length
    ? await Promise.all([
        supabase
          .from("workout_sets")
          .select("session_id, weight_kg, reps")
          .in("session_id", doneSessionIds),
        supabase
          .from("events")
          .select("payload")
          .eq("user_id", user!.id)
          .eq("event_type", "session_completed")
          .in("payload->>session_id", doneSessionIds),
      ])
    : [{ data: [] }, { data: [] }];

  const prCountBySession = new Map<string, number>();
  for (const e of doneEvents ?? []) {
    const payload = (e.payload ?? {}) as { session_id?: string; pr_exercise_ids?: string[] };
    if (payload.session_id) {
      prCountBySession.set(payload.session_id, (payload.pr_exercise_ids ?? []).length);
    }
  }

  const dayStatus: Record<string, DayStatus> = {};
  for (const session of doneSessions) {
    if (!session.user_program_day_id) continue;
    const sets = (doneSets ?? []).filter((s) => s.session_id === session.id);
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
    };
  }
  if (
    openSession?.user_program_day_id &&
    !dayStatus[openSession.user_program_day_id]
  ) {
    dayStatus[openSession.user_program_day_id] = { state: "in_progress" };
  }
  const allExercises = (allExercisesRaw ?? []) as (ExerciseRow & { name_en: string; name_ar: string | null })[];
  // The swap picker must offer the same equipment the generator used, so it
  // resolves location + the two equipment multi-selects through the same map.
  const { data: equipmentRule } = await supabase
    .from("questionnaire_rules")
    .select("payload")
    .eq("key", "equipment_option_map")
    .maybeSingle();

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

  const days: EditorDay[] = dayRows.map((day) => ({
    id: day.id,
    dayNumber: day.day_number,
    dayName: day.day_name,
    exercises: (day.user_program_exercises ?? [])
      .filter((row) => row.exercises)
      .map((row) => {
        const ex = row.exercises!;
        const substitutes = safePool
          .filter((c) => c.id !== ex.id && (ex.substitution_group ? c.substitution_group === ex.substitution_group : c.primary_muscle === ex.primary_muscle))
          .slice(0, 4)
          .map((c) => {
            const full = allExercises.find((a) => a.id === c.id)!;
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

  return (
    <ProgramEditor locale={locale} programId={program.id} initialDays={days} dayStatus={dayStatus} />
  );
}
