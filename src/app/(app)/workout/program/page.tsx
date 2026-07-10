import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { ProgramEditor, type EditorDay } from "@/components/workout/program-editor";
import { filterSafeExercises, type ExerciseRow, type TrainingEquipment } from "@/lib/algorithms/exercise-substitution";
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
    .select("id, equipment, injuries, experience")
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
  const allExercises = (allExercisesRaw ?? []) as (ExerciseRow & { name_en: string; name_ar: string | null })[];
  const safePool = filterSafeExercises(allExercises, {
    injuries: trainingProfile.injuries ?? [],
    trainingEquipment: trainingProfile.equipment as TrainingEquipment,
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

  return <ProgramEditor locale={locale} programId={program.id} initialDays={days} />;
}
