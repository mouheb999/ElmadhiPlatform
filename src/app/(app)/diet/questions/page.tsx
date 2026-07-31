import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getRedoQuota } from "@/lib/plan-redo";
import { RedoLimitCard } from "@/components/shared/redo-limit-card";
import { DietQuestionsClient } from "./diet-questions-client";

export const dynamic = "force-dynamic";

export default async function DietQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string }>;
}) {
  const [locale, { redo }] = await Promise.all([getLocale(), searchParams]);

  // Only a redo is capped — first-time onboarding always goes through.
  if (redo) {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (user) {
      const quota = await getRedoQuota(supabase, user.id, "diet");
      if (quota.remaining <= 0) {
        return (
          <div className="mx-auto max-w-lg">
            <RedoLimitCard locale={locale} limit={quota.limit} />
          </div>
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <DietQuestionsClient locale={locale} />
    </div>
  );
}
