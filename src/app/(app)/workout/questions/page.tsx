import { getLocale } from "@/lib/i18n-server";
import { WorkoutQuestionsClient } from "./workout-questions-client";

export const dynamic = "force-dynamic";

export default async function WorkoutQuestionsPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-lg">
      <WorkoutQuestionsClient locale={locale} />
    </div>
  );
}
