import { getLocale } from "@/lib/i18n-server";
import { DietQuestionsClient } from "./diet-questions-client";

export const dynamic = "force-dynamic";

export default async function DietQuestionsPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-lg">
      <DietQuestionsClient locale={locale} />
    </div>
  );
}
