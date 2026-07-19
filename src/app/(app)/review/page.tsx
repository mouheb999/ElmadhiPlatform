import Link from "next/link";
import { ArrowRight, BookOpen, Dumbbell, Moon, Scale, Trophy, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { pick, t, type StringKey } from "@/lib/i18n";
import { weeklySummary, type FocusArea } from "@/lib/algorithms/weekly-review";
import { computeDietProposal } from "@/lib/coach/diet-proposal";
import { AdaptationCard } from "@/components/review/adaptation-card";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FOCUS_TO_SLUG: Record<Exclude<FocusArea, null>, string> = {
  training: "training",
  nutrition: "nutrition",
  recovery: "recovery",
};

/**
 * Weekly review (V1.5): the last 7 days turned into a coaching report —
 * adherence, averages, weight trend, a rules-based coach summary, and
 * knowledge cards matched to the week's weakest area.
 */
export default async function WeeklyReviewPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const startDate = isoDate(start);
  const startIso = start.toISOString();

  const [
    { data: trainingProfile },
    { data: dietProfile },
    { data: sessions },
    { data: prEvents },
    { data: logs },
    { data: checkins },
  ] = await Promise.all([
    supabase
      .from("training_profiles")
      .select("days_per_week")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("diet_profiles")
      .select("id, goal")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user!.id)
      .not("completed_at", "is", null)
      .gte("completed_at", startIso),
    supabase
      .from("events")
      .select("payload")
      .eq("user_id", user!.id)
      .eq("event_type", "session_completed")
      .gte("created_at", startIso),
    supabase
      .from("meal_logs")
      .select("log_date, calories, protein_g")
      .eq("user_id", user!.id)
      .gte("log_date", startDate),
    supabase
      .from("daily_checkins")
      .select("checkin_date, weight_kg, sleep_hours")
      .eq("user_id", user!.id)
      .gte("checkin_date", startDate)
      .order("checkin_date", { ascending: true }),
  ]);

  const { data: macros } = dietProfile
    ? await supabase
        .from("macro_targets")
        .select("calories, protein_g")
        .eq("diet_profile_id", dietProfile.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // ---- Aggregate the week ----
  const byDate = new Map<string, { calories: number; proteinG: number }>();
  for (const log of logs ?? []) {
    const day = byDate.get(log.log_date) ?? { calories: 0, proteinG: 0 };
    day.calories += log.calories;
    day.proteinG += log.protein_g;
    byDate.set(log.log_date, day);
  }
  const loggedDays = byDate.size;
  const dayTotals = [...byDate.values()];
  const avgCalories = loggedDays
    ? dayTotals.reduce((s, d) => s + d.calories, 0) / loggedDays
    : null;
  const avgProteinG = loggedDays
    ? dayTotals.reduce((s, d) => s + d.proteinG, 0) / loggedDays
    : null;

  const sleeps = (checkins ?? []).map((c) => c.sleep_hours).filter((s): s is number => s !== null);
  const avgSleepH = sleeps.length ? sleeps.reduce((s, v) => s + v, 0) / sleeps.length : null;

  const weights = (checkins ?? []).map((c) => c.weight_kg).filter((w): w is number => w !== null);
  const weightStartKg = weights.length >= 2 ? weights[0] : null;
  const weightEndKg = weights.length >= 2 ? weights[weights.length - 1] : null;

  const prCount = (prEvents ?? []).filter((e) => {
    const payload = e.payload as { pr_exercise_ids?: string[] } | null;
    return (payload?.pr_exercise_ids?.length ?? 0) > 0;
  }).length;

  const sessionsDone = (sessions ?? []).length;
  const weekTarget = trainingProfile?.days_per_week ?? 0;

  const adaptationContext = await computeDietProposal(supabase, user!.id);

  const summary = weeklySummary({
    sessionsDone,
    weekTarget,
    loggedDays,
    avgCalories,
    avgProteinG,
    calorieTarget: macros?.calories ?? null,
    proteinTargetG: macros?.protein_g ?? null,
    avgSleepH,
    weightStartKg,
    weightEndKg,
    goal: dietProfile?.goal ?? null,
    prCount,
  });

  // ---- Contextual knowledge: 2 cards from the week's weakest area ----
  let recommended: { id: string; questionEn: string | null; questionAr: string | null }[] = [];
  if (summary.focus) {
    const { data: category } = await supabase
      .from("qa_categories")
      .select("id")
      .eq("slug", FOCUS_TO_SLUG[summary.focus])
      .maybeSingle();
    if (category) {
      const { data: cards } = await supabase
        .from("qa_cards")
        .select("id, question_en, question_ar")
        .eq("category_id", category.id)
        .eq("is_published", true)
        .order("order_index", { ascending: true })
        .limit(2);
      recommended = (cards ?? []).map((c) => ({
        id: c.id,
        questionEn: c.question_en,
        questionAr: c.question_ar,
      }));
    }
  }

  const weightDelta =
    weightStartKg !== null && weightEndKg !== null
      ? Math.round((weightEndKg - weightStartKg) * 10) / 10
      : null;

  const stats = [
    {
      icon: Dumbbell,
      label: t(locale, "review.workouts"),
      value: weekTarget > 0 ? `${sessionsDone}/${weekTarget}` : String(sessionsDone),
    },
    { icon: UtensilsCrossed, label: t(locale, "review.nutrition_days"), value: `${loggedDays}/7` },
    {
      icon: UtensilsCrossed,
      label: t(locale, "review.avg_protein"),
      value: avgProteinG !== null ? `${Math.round(avgProteinG)}g` : "—",
    },
    {
      icon: Moon,
      label: t(locale, "review.avg_sleep"),
      value: avgSleepH !== null ? `${Math.round(avgSleepH * 10) / 10}h` : "—",
    },
    {
      icon: Scale,
      label: t(locale, "review.weight_change"),
      value: weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg` : "—",
    },
    { icon: Trophy, label: t(locale, "review.prs"), value: String(prCount) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "review.title")}</h1>
        <p className="text-muted">{t(locale, "review.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-hairline bg-surface p-4">
            <stat.icon className="h-4 w-4 text-muted" />
            <div className="mt-2 text-xl font-extrabold tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      <Link
        href="/progress"
        className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-white/5"
      >
        <span className="text-sm font-bold">{t(locale, "progress.title")}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-accent rtl:rotate-180" />
      </Link>

      {adaptationContext && (
        <AdaptationCard
          locale={locale}
          proposal={{
            reasonKey: adaptationContext.proposal.reasonKey,
            oldCalories: adaptationContext.proposal.oldCalories,
            newCalories: adaptationContext.proposal.newCalories,
            deltaKcal: adaptationContext.proposal.deltaKcal,
            trendKg: adaptationContext.proposal.trendKg,
            newProteinG: adaptationContext.proposal.newProteinG,
            newCarbsG: adaptationContext.proposal.newCarbsG,
            newFatG: adaptationContext.proposal.newFatG,
          }}
        />
      )}

      <div className="flex flex-col gap-3 rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-6">
        <span className="w-max rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          {t(locale, "review.coach_title")}
        </span>
        <ul className="flex flex-col gap-2">
          {summary.keys.map((key) => (
            <li key={key} className="text-sm font-semibold leading-relaxed">
              • {t(locale, key as StringKey)}
            </li>
          ))}
        </ul>
      </div>

      {recommended.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <BookOpen className="h-4 w-4" />
            {t(locale, "review.recommended")}
          </div>
          {recommended.map((card) => (
            <Link
              key={card.id}
              href={`/qa/${card.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-white/5"
            >
              <span className="text-sm font-semibold">{pick(locale, card.questionEn, card.questionAr)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-accent rtl:rotate-180" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
