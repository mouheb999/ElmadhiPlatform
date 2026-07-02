import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { ExercisesClient } from "./exercises-client";

export const dynamic = "force-dynamic";

export default async function AdminExercisesPage() {
  const locale = await getLocale();
  const db = createAdminClient();

  // Explicit column list: never SELECT * here — it would pull the heavy
  // `search_vector` tsvector for every row and bloat the payload.
  const { data: exercises } = await db
    .from("exercises")
    .select(
      "id, name_ar, name_en, name_fr, primary_muscle, secondary_muscles, equipment, movement_pattern, difficulty, contraindicated_for, video_url, thumbnail_url, instructions, created_at",
    )
    .order("primary_muscle", { ascending: true })
    .order("name_en", { ascending: true });

  return <ExercisesClient locale={locale} exercises={exercises ?? []} />;
}
