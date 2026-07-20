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

  // Migration 026 deletes these rows; the filter keeps the retired questions
  // out of the flow on a database that hasn't applied it yet.
  const RETIRED = ["session_duration", "body_focus"];
  const active = (questions ?? []).filter((q) => !RETIRED.includes(q.id));

  return (
    <div className="mx-auto max-w-lg">
      <WorkoutQuestionsClient locale={locale} questions={active as QuestionRow[]} />
    </div>
  );
}
