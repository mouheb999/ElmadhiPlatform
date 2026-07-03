import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Workout Maker has no landing screen once a program exists — tapping into
 * it goes straight to the program. "Redo my workout goals" lives only in
 * Settings. */
export default async function WorkoutLandingPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  if (trainingProfile) redirect("/workout/program");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "dashboard.workout_title")}</h1>
      <p className="max-w-xs text-muted">{t(locale, "dashboard.workout_not_started")}</p>
      <Button asChild size="lg">
        <Link href="/workout/questions">{t(locale, "dashboard.cta_start")}</Link>
      </Button>
    </div>
  );
}
