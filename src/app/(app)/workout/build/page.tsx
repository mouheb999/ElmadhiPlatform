import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getRedoQuota } from "@/lib/plan-redo";
import { RedoLimitCard } from "@/components/shared/redo-limit-card";
import { LoadFailure } from "@/components/shared/load-failure";
import { pick } from "@/lib/i18n";
import {
  SplitBuilder,
  type BuilderExercise,
  type BuilderQuestions,
  type SplitShape,
} from "@/components/workout/split-builder";

export const dynamic = "force-dynamic";

/**
 * The hand-built route into a program.
 *
 * The questionnaire's counterpart, not its replacement: everything downstream
 * of here — /workout/program, the session recorder, the weekly gate — is shared,
 * because both routes write the same three tables.
 *
 * The whole catalog is handed to the client rather than searched over the wire.
 * It is 213 rows of short strings, which is smaller than a single exercise
 * thumbnail, and a builder whose search box waits on a round-trip per keystroke
 * is a builder nobody finishes on a phone.
 */
export default async function WorkoutBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string }>;
}) {
  const [locale, { redo }] = await Promise.all([getLocale(), searchParams]);
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/workout/build");

  // Same rule as the guided flow: onboarding is never capped, rebuilding is.
  // Checked here as well as in the action so somebody who is out of rebuilds
  // hears it before spending ten minutes assembling a split.
  if (redo) {
    const quota = await getRedoQuota(supabase, user.id, "workout");
    if (quota.remaining <= 0) {
      return (
        <div className="mx-auto max-w-lg">
          <RedoLimitCard locale={locale} limit={quota.limit} />
        </div>
      );
    }
  }

  const [{ data: exercisesRaw, error: exercisesError }, { data: splitsRaw }, { data: questionRows }] =
    await Promise.all([
    supabase
      .from("exercises")
      .select("id, name_en, name_ar, primary_muscle, equipment, thumbnail_url")
      .order("primary_muscle", { ascending: true }),
    // Only the day *names* of the pre-built splits. Offered as a starting shape
    // ("Push / Pull / Legs") so somebody who knows the structure they want but
    // not what to call it doesn't start from a blank screen — the exercises
    // inside them are deliberately not copied, or this would just be the
    // guided flow with extra steps.
    supabase
      .from("fixed_splits")
      .select("id, title_en, gender, days_per_week, fixed_split_days(day_number, day_name_en, day_name_ar)")
      .order("days_per_week", { ascending: true }),
    // The builder asks the same three questions the questionnaire opens with,
    // and they land in the same CHECK-constrained columns — so the option text
    // comes from the same rows rather than being re-translated here. The stored
    // value stays the English string; only the label is localised, exactly as
    // `WorkoutQuestionsClient` does it.
    supabase
      .from("questionnaire_questions")
      .select("id, question_en, question_ar, options, options_ar")
      .in("id", ["gender", "goal", "experience"]),
  ]);

  if (exercisesError) return <LoadFailure detail={exercisesError.message} />;

  type QuestionRow = {
    id: string;
    question_en: string;
    question_ar: string | null;
    options: string[];
    options_ar: string[] | null;
  };

  /**
   * One question's options as {value, label}. Falls back to the English option
   * text when a database has no Arabic for it, which is what the questionnaire
   * does too — a missing translation should never blank a choice.
   */
  function askedQuestion(id: string, fallbackOptions: string[]): {
    title: string;
    options: { value: string; label: string }[];
  } {
    const row = ((questionRows ?? []) as QuestionRow[]).find((q) => q.id === id);
    const values = row?.options?.length ? row.options : fallbackOptions;
    return {
      title: row ? pick(locale, row.question_en, row.question_ar) : "",
      options: values.map((value, i) => ({
        value,
        label: locale === "tn" ? (row?.options_ar?.[i] ?? value) : value,
      })),
    };
  }

  const questions = {
    gender: askedQuestion("gender", ["Male", "Female", "Prefer not to say"]),
    goal: askedQuestion("goal", [
      "Muscle growth (hypertrophy)",
      "Strength",
      "Fat loss",
      "Body recomposition (lose fat + build muscle)",
      "General fitness / home convenience",
    ]),
    experience: askedQuestion("experience", [
      "Beginner (0-6 months)",
      "Intermediate (6mo-2yrs)",
      "Advanced (2+ yrs)",
    ]),
  };

  const exercises: BuilderExercise[] = (exercisesRaw ?? []).map((e) => ({
    id: e.id,
    nameEn: e.name_en,
    nameAr: e.name_ar,
    primaryMuscle: e.primary_muscle,
    equipment: e.equipment,
    thumbnailUrl: e.thumbnail_url,
  }));

  type SplitRow = {
    id: string;
    title_en: string;
    gender: string;
    days_per_week: number;
    fixed_split_days: { day_number: number; day_name_en: string; day_name_ar: string | null }[];
  };

  const shapes: SplitShape[] = ((splitsRaw ?? []) as unknown as SplitRow[])
    .map((split) => ({
      id: split.id,
      // The sheet's titles carry a trailing gender to keep its rows distinct;
      // the user picking a shape has no use for it.
      titleEn: split.title_en.replace(/\s+(Male|Female)$/i, ""),
      gender: split.gender,
      daysPerWeek: split.days_per_week,
      dayNames: [...(split.fixed_split_days ?? [])]
        .sort((a, b) => a.day_number - b.day_number)
        .map((d) => ({ en: d.day_name_en, ar: d.day_name_ar })),
    }))
    .filter((shape) => shape.dayNames.length > 0);

  return (
    <div className="mx-auto max-w-lg">
      <SplitBuilder
        locale={locale}
        exercises={exercises}
        shapes={shapes}
        questions={questions satisfies BuilderQuestions}
        isRedo={!!redo}
      />
    </div>
  );
}
