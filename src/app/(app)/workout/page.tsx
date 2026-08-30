import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { BuildModeChoice } from "@/components/shared/build-mode-choice";
import { ProgramView } from "./_views/program-view";

export const dynamic = "force-dynamic";

/** Stand-in for the program editor: the day tabs, the CTA, the exercise cards. */
function ProgramSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-surface" />
        ))}
      </div>
      <div className="mx-auto h-12 w-44 animate-pulse rounded-full bg-surface" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}

/**
 * Workout Maker. Once a program exists this IS the program — there is no
 * landing screen in front of it, and "Redo my workout goals" lives in Settings.
 *
 * It used to answer that with `redirect("/workout/program")`, which cost the
 * user a whole extra navigation on the app's most-tapped tab: the bottom nav
 * prefetches /workout, the prefetch warmed a route that only 307s, and the
 * destination it bounced to had no warmth and no loading boundary of its own.
 * Rendering the program here instead means the tap lands on the route that was
 * prefetched. /workout/program is kept as a redirect the other way, so old
 * links, bookmarks and `revalidatePath` calls still resolve.
 *
 * Only ONE query runs before the shell: does a training profile exist? The
 * program itself streams in behind `<Suspense>`, the same shape /diet uses.
 */
export default async function WorkoutPage() {
  const [supabase, locale, user] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
  ]);

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  // Before there is a program, this is the fork: answer the questionnaire and
  // be handed a split, or open the builder and assemble one. It used to be a
  // single "Start" button into the questionnaire, which made the guided route
  // look like the only route rather than the recommended one.
  if (!trainingProfile) {
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

  return (
    <Suspense fallback={<ProgramSkeleton />}>
      <ProgramView locale={locale} />
    </Suspense>
  );
}
