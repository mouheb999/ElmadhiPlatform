import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { WorkoutQuestionsClient, type QuestionRow } from "./workout-questions-client";

export const dynamic = "force-dynamic";

export default async function WorkoutQuestionsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("questionnaire_questions")
    .select("id, order_index, question_en, question_ar, type, options, options_ar, shown_if, max_selections")
    .order("order_index", { ascending: true });

  return (
    <div className="mx-auto max-w-lg">
      <WorkoutQuestionsClient locale={locale} questions={(questions ?? []) as QuestionRow[]} />
    </div>
  );
}
