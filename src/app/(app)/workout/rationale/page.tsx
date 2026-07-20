import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { RationaleCard } from "@/components/shared/rationale-card";
import { repSchemeFor } from "@/lib/algorithms/split-fill";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Split copy comes from `split_definitions` (migrated from splits.json), not a
 * hardcoded map. `user_programs.split_type` now holds the split id
 * ("arnold_ul_4day"), which is that table's primary key.
 */

export default async function WorkoutRationalePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id, days_per_week, experience, goal, injuries, training_style")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!trainingProfile) redirect("/workout/questions");

  const { data: program } = await supabase
    .from("user_programs")
    .select("id, name, split_type")
    .eq("training_profile_id", trainingProfile.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!program) redirect("/workout/questions");

  const { data: split } = await supabase
    .from("split_definitions")
    .select("label_en, label_ar, note_en, note_ar")
    .eq("id", program.split_type)
    .maybeSingle();

  const splitEn = split?.note_en || split?.label_en || "This split fits how many days you can train.";
  const splitAr = split?.note_ar || split?.label_ar || "هالتقسيمة تناسب عدد الأيام اللي تنجم تتمرن فيهم.";

  const scheme = repSchemeFor({
    goal: trainingProfile.goal,
    trainingStyle: trainingProfile.training_style ?? undefined,
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">
        {t(locale, "workout.rationale_title")}
      </h1>

      <RationaleCard headline={program.name} body={locale === "tn" ? splitAr : splitEn} emphasis />

      <RationaleCard
        headline={locale === "tn" ? "عدد المجموعات والتكرارات" : "Sets and reps"}
        body={
          locale === "tn"
            ? `${scheme.sets} مجموعات × ${scheme.repRange} تكرار، مع راحة ${scheme.restSeconds} ثانية بين المجموعات — مبني على هدفك وأسلوب التمرين اللي اخترتو.`
            : `${scheme.sets} sets of ${scheme.repRange} reps, resting ${scheme.restSeconds}s between sets — based on your goal and the training style you chose.`
        }
      />

      {trainingProfile.injuries && trainingProfile.injuries.length > 0 && (
        <RationaleCard
          headline={locale === "tn" ? "تعديلات بسبب الإصابات" : "Injury adjustments"}
          body={
            locale === "tn"
              ? `بدّلنا شوية تمارين بسبب: ${trainingProfile.injuries.join(", ")}.`
              : `We swapped a few exercises because of: ${trainingProfile.injuries.join(", ")}.`
          }
        />
      )}

      <Button asChild size="lg" className="mt-2">
        <Link href="/workout/program">{t(locale, "workout.see_program")}</Link>
      </Button>
    </div>
  );
}
