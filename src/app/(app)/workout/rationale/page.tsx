import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { RationaleCard } from "@/components/shared/rationale-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const SPLIT_EXPLANATION_EN: Record<string, string> = {
  full_body: "Full Body hits every muscle each session — great when you can only train 2 days a week.",
  upper_lower: "Upper/Lower splits your week so each muscle recovers fully before you train it again.",
  ppl: "Push/Pull/Legs groups movements by direction, so nothing gets trained two days in a row.",
  arnold: "The Arnold split gives chest & back, shoulders & arms, and legs their own dedicated day each.",
};

const SPLIT_EXPLANATION_AR: Record<string, string> = {
  full_body: "الفل بادي يخدم كل عضلة في كل حصة — مناسب إذا تنجم تتمرن يومين في الجمعة برك.",
  upper_lower: "أعلى/أسفل الجسم يوزع الجمعة باش كل عضلة تاخو راحتها قبل ما تخدمها مرة أخرى.",
  ppl: "دفع/سحب/أرجل يجمع الحركات حسب الاتجاه، باش ما تخدمش نفس العضلة يومين متتاليين.",
  arnold: "تقسيمة أرنولد تعطي الصدر والظهر، الأكتاف والذراعين، والأرجل، كل وحدة يوم خاص بيها.",
};

export default async function WorkoutRationalePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id, days_per_week, experience, goal, equipment, injuries")
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

  const splitEn = SPLIT_EXPLANATION_EN[program.split_type] ?? "This split fits how many days you can train.";
  const splitAr = SPLIT_EXPLANATION_AR[program.split_type] ?? "هالتقسيمة تناسب عدد الأيام اللي تنجم تتمرن فيهم.";

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
            ? "الحركات المركبة 2-3 مجموعات من 8-10 تكرار، والحركات العزل 2 مجموعات من 10-12 تكرار — نفس المنهج المستعمل في كل الجداول."
            : "Compound lifts get 2-3 sets of 8-10 reps, isolation lifts get 2 sets of 10-12 reps — the same scheme across every template."
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
