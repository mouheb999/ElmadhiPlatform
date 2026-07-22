import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { RationaleCard } from "@/components/shared/rationale-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Split copy comes from `fixed_splits` (the pre-built sheet), matched by
 * `user_programs.split_type`, which now holds the fixed-split id
 * ("full_body_2day_male"). No sets/reps engine runs any more — each exercise
 * carries its own rep range from the sheet.
 */
export default async function WorkoutRationalePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("id, days_per_week, experience, goal, injuries")
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
    .from("fixed_splits")
    .select("title_en, week_order_en")
    .eq("id", program.split_type)
    .maybeSingle();

  const weekOrder = split?.week_order_en;
  const splitEn = weekOrder
    ? `Your week runs ${weekOrder}. It matches the ${trainingProfile.days_per_week} days a week you can train.`
    : "This split matches how many days a week you can train.";
  const splitAr = weekOrder
    ? `ترتيب جمعتك: ${weekOrder}. يناسب ${trainingProfile.days_per_week} أيام في الجمعة اللي تنجم تتمرن فيهم.`
    : "هالتقسيمة تناسب عدد الأيام اللي تنجم تتمرن فيهم.";

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
            ? "كل تمرين يجي بنطاق التكرارات متاعه من البرنامج: الحركات المركبة الثقيلة تكرارات أقل وراحة أطول، وتمارين العزل تكرارات أعلى وراحة أقصر."
            : "Every exercise comes with its own rep range from your plan — heavier compound lifts use fewer reps and longer rest, isolation work uses higher reps and shorter rest."
        }
      />

      {trainingProfile.injuries && trainingProfile.injuries.length > 0 && (
        <RationaleCard
          headline={locale === "tn" ? "انتبه للإصابات" : "Injury awareness"}
          body={
            locale === "tn"
              ? `سجّلنا إصاباتك: ${trainingProfile.injuries.join("، ")}. تنجم تبدّل أي تمرين من صفحة البرنامج بخيار يريّحك أكثر.`
              : `We noted your injuries: ${trainingProfile.injuries.join(", ")}. You can swap any exercise on the program page for a gentler option.`
          }
        />
      )}

      <Button asChild size="lg" className="mt-2">
        <Link href="/workout/program">{t(locale, "workout.see_program")}</Link>
      </Button>
    </div>
  );
}
