import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { NutritionTabs, type NutritionView } from "@/components/diet/nutrition-tabs";
import { TodayView } from "./_views/today-view";
import { PlanView } from "./_views/plan-view";

export const dynamic = "force-dynamic";

/**
 * Unified nutrition home. One route, two views switched by `?view=today|plan`
 * (Today is the default — the daily coaching loop is the product; the Plan is a
 * reference one tap away). Day browsing for Today rides on `?date=`. The former
 * /diet/plan and /diet/log routes now redirect in here. Before a diet profile
 * exists there's no tabbed content — just the start CTA.
 */
export default async function DietPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!dietProfile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "dashboard.diet_title")}</h1>
        <p className="max-w-xs text-muted">{t(locale, "dashboard.diet_not_started")}</p>
        <Button asChild size="lg">
          <Link href="/diet/questions">{t(locale, "dashboard.cta_start")}</Link>
        </Button>
      </div>
    );
  }

  const { view, date } = await searchParams;
  const current: NutritionView = view === "plan" ? "plan" : "today";

  return (
    <div className="flex flex-col gap-5">
      <NutritionTabs current={current} locale={locale} />
      {current === "plan" ? (
        <PlanView locale={locale} userId={user!.id} />
      ) : (
        <TodayView locale={locale} userId={user!.id} dateParam={date} />
      )}
    </div>
  );
}
