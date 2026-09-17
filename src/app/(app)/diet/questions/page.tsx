import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getRedoQuota } from "@/lib/plan-redo";
import { RedoLimitCard } from "@/components/shared/redo-limit-card";
import { FUNNEL_COOKIE, parseFunnelAnswers, toDietPrefill } from "@/lib/funnel/answers";
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

  /**
   * What they already told us on /start, before they had an account.
   *
   * Eight of the questions below were answered during sign-up — goal, gender,
   * age, height, weight, target, training days, meals. Asking them again is
   * how a funnel tells its new customer that the four minutes before payment
   * were theatre, so the wizard opens with them filled in and still editable.
   *
   * Not on a redo: somebody deliberately rebuilding their plan is changing
   * their mind, and handing them the answers they gave months ago is the
   * opposite of what they came for.
   */
  const prefill = redo
    ? {}
    : toDietPrefill(parseFunnelAnswers((await cookies()).get(FUNNEL_COOKIE)?.value));

  return (
    <div className="mx-auto max-w-lg">
      <DietQuestionsClient locale={locale} isRedo={!!redo} funnelPrefill={prefill} />
    </div>
  );
}
