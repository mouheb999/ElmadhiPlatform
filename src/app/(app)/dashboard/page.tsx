import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { HeroFocus } from "@/components/dashboard/hero-focus";
import { NutritionTile } from "@/components/dashboard/nutrition-tile";
import { TrainingTile } from "@/components/dashboard/training-tile";
import { QaSpark, type QaSparkCard } from "@/components/dashboard/qa-spark";

export const dynamic = "force-dynamic";

function shuffled<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: dietProfile }, { data: trainingProfile }, { data: qaCardsRaw }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("diet_profiles")
      .select("id")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("training_profiles")
      .select("id, days_per_week")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("qa_cards")
      .select("id, question_en, question_ar, answer_short, answer_short_ar")
      .eq("is_published", true),
  ]);

  const [{ data: macros }, { data: userProgram }] = await Promise.all([
    dietProfile
      ? supabase
          .from("macro_targets")
          .select("calories, protein_g, carbs_g, fat_g")
          .eq("diet_profile_id", dietProfile.id)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    trainingProfile
      ? supabase
          .from("user_programs")
          .select("name, split_type")
          .eq("training_profile_id", trainingProfile.id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const nutritionTarget = macros
    ? { calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }
    : null;

  const trainingProgram =
    userProgram && trainingProfile
      ? { name: userProgram.name, splitType: userProgram.split_type, daysPerWeek: trainingProfile.days_per_week }
      : null;

  const qaCards: QaSparkCard[] = shuffled(
    (qaCardsRaw ?? []).map((c) => ({
      id: c.id,
      questionEn: c.question_en,
      questionAr: c.question_ar,
      answerShort: c.answer_short,
      answerShortAr: c.answer_short_ar,
    })),
    5,
  );

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t(locale, "dashboard.greeting")}</p>
        {firstName && <h2 className="text-lg font-extrabold">{firstName}</h2>}
      </div>

      <HeroFocus
        locale={locale}
        dietActive={!!dietProfile}
        workoutActive={!!trainingProfile}
        program={trainingProgram}
        calorieTarget={nutritionTarget?.calories ?? null}
      />

      <div className="grid grid-cols-2 gap-3">
        <NutritionTile locale={locale} target={nutritionTarget} />
        <TrainingTile locale={locale} program={trainingProgram} />
      </div>

      <QaSpark locale={locale} cards={qaCards} />
    </div>
  );
}
