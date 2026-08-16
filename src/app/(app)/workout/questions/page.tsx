import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getRedoQuota } from "@/lib/plan-redo";
import { RedoLimitCard } from "@/components/shared/redo-limit-card";
import { WorkoutQuestionsClient, type QuestionRow } from "./workout-questions-client";

export const dynamic = "force-dynamic";

export default async function WorkoutQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string }>;
}) {
  const [locale, { redo }] = await Promise.all([getLocale(), searchParams]);
  const supabase = await createClient();

  // Only a redo is capped — first-time onboarding always goes through.
  if (redo) {
    const user = await getCurrentUser();
    if (user) {
      const quota = await getRedoQuota(supabase, user.id, "workout");
      if (quota.remaining <= 0) {
        return (
          <div className="mx-auto max-w-lg">
            <RedoLimitCard locale={locale} limit={quota.limit} />
          </div>
        );
      }
    }
  }

  const { data: questions } = await supabase
    .from("questionnaire_questions")
    .select("id, order_index, question_en, question_ar, type, options, options_ar, shown_if, max_selections")
    .order("order_index", { ascending: true });

  // Migrations 026 and 027 delete these rows; the filter keeps the retired
  // questions out of the flow on a database that hasn't applied them yet. They
  // only fed the old slot-filling picker, which fixed splits replace.
  const RETIRED = [
    "session_duration",
    "body_focus",
    "training_style",
    "pullup_ability",
    "lift_comfort",
    "age_bracket",
    "exercise_dislikes",
    "weight_goal",
    "cardio_preference",
  ];
  const active = (questions ?? []).filter((q) => !RETIRED.includes(q.id));

  return (
    <div className="mx-auto max-w-lg">
      <WorkoutQuestionsClient
        locale={locale}
        questions={active as QuestionRow[]}
        isRedo={!!redo}
      />
    </div>
  );
}
