import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { NutritionTabs, type NutritionView } from "@/components/diet/nutrition-tabs";
import { TodayView } from "./_views/today-view";
import { PlanView } from "./_views/plan-view";

export const dynamic = "force-dynamic";

/** Stand-in for whichever nutrition view is loading. Roughly their shared shape. */
function NutritionViewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-36 w-full animate-pulse rounded-3xl bg-surface" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-surface" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-surface" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

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
  const [supabase, locale, user] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
  ]);

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
      {/* The active diet profile is already in hand — hand it down so the view
          doesn't re-query it and, worse, have to wait on that answer before it
          can ask for the macro targets keyed to it.

          Suspended so the tab bar is on screen the moment the shell resolves.
          Switching Today/Plan is a tap between two heavy reads, and without a
          boundary here that tap left the user on the previous view with no
          sign anything had happened. The key makes React remount on the switch
          rather than hold the old view while the new one loads. */}
      <Suspense key={`${current}-${date ?? ""}`} fallback={<NutritionViewSkeleton />}>
        {current === "plan" ? (
          <PlanView locale={locale} userId={user!.id} dietProfileId={dietProfile.id} />
        ) : (
          <TodayView
            locale={locale}
            userId={user!.id}
            dietProfileId={dietProfile.id}
            dateParam={date}
          />
        )}
      </Suspense>
    </div>
  );
}
