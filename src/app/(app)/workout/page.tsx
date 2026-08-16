import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { BuildModeChoice } from "@/components/shared/build-mode-choice";

export const dynamic = "force-dynamic";

/**
 * Workout Maker has no landing screen once a program exists — tapping into it
 * goes straight to the program. "Redo my workout goals" lives only in Settings.
 *
 * Before there is a program, this is the fork: answer the questionnaire and be
 * handed a split, or open the builder and assemble one. It used to be a single
 * "Start" button into the questionnaire, which made the guided route look like
 * the only route rather than the recommended one.
 */
export default async function WorkoutLandingPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const user = await getCurrentUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  if (trainingProfile) redirect("/workout/program");

  return (
    <BuildModeChoice
      locale={locale}
      title={t(locale, "dashboard.workout_title")}
      guidedHref="/workout/questions"
      guidedBody="build.guided_workout"
      customHref="/workout/build"
      customBody="build.custom_workout"
    />
  );
}
