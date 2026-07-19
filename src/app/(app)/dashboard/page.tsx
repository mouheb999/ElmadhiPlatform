import Link from "next/link";
import { Flame, MessageCircleQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { CheckinCard, type TodayCheckin } from "@/components/dashboard/checkin-card";
import { TodayWorkout, type TodayWorkoutDay, type TodayWorkoutState } from "@/components/dashboard/today-workout";
import { MealsTile, type MealsTileMeal } from "@/components/dashboard/meals-tile";
import { NutritionLiveTile } from "@/components/dashboard/nutrition-live-tile";
import { QaSpark, type QaSparkCard } from "@/components/dashboard/qa-spark";
import { ProgressTeaser } from "@/components/dashboard/progress-teaser";
import { Reveal } from "@/components/shared/reveal";
import { prevDateKey, tunisDateKey, tunisDayStartUtc, tunisWeekStartUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";

function shuffled<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** Consecutive-day streak over check-in dates (desc), anchored at today or yesterday (Tunis). */
function checkinStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  let cursor = tunisDateKey();
  if (datesDesc[0] !== cursor) {
    cursor = prevDateKey(cursor);
    if (datesDesc[0] !== cursor) return 0;
  }
  let streak = 0;
  for (const date of datesDesc) {
    if (date !== cursor) break;
    streak += 1;
    cursor = prevDateKey(cursor);
  }
  return streak;
}

/**
 * The Today screen. Not a summary of what the user set up once — a live
 * answer to "what does ELMADHI want from me today, and what did it notice?"
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Today" and "this week" in Africa/Tunis — never server-local time.
  const today = tunisDateKey();
  const todayStart = tunisDayStartUtc();
  const weekStart = tunisWeekStartUtc();

  const [
    { data: profile },
    { data: dietProfile },
    { data: trainingProfile },
    { data: qaCardsRaw },
    { data: checkins },
    { data: answeredRequests },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    supabase.from("diet_profiles").select("id").eq("user_id", user!.id).eq("is_active", true).maybeSingle(),
    supabase
      .from("training_profiles")
      .select("id, days_per_week")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("qa_cards").select("id, question_en, question_ar, answer_short, answer_short_ar").eq("is_published", true),
    supabase
      .from("daily_checkins")
      .select("checkin_date, weight_kg, energy, sleep_hours")
      .eq("user_id", user!.id)
      .order("checkin_date", { ascending: false })
      .limit(60),
    supabase
      .from("qa_requests")
      .select("id")
      .eq("user_id", user!.id)
      .eq("status", "published")
      .is("answered_seen_at", null),
  ]);

  // ---- Nutrition: targets + today's plan meals + today's logged intake ----
  const [{ data: macros }, { data: mealPlan }, { data: todayLogs }] = await Promise.all([
    dietProfile
      ? supabase
          .from("macro_targets")
          .select("calories, protein_g, carbs_g, fat_g")
          .eq("diet_profile_id", dietProfile.id)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user!.id)
      .eq("log_date", today),
  ]);

  const consumed = (todayLogs ?? []).reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      proteinG: acc.proteinG + log.protein_g,
      carbsG: acc.carbsG + log.carbs_g,
      fatG: acc.fatG + log.fat_g,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  type MealRow = {
    id: string;
    meal_type: string;
    order_index: number;
    meal_plan_items: { quantity_g: number | null; foods: { calories_per_100g: number | null } | null }[];
  };
  const { data: mealRowsRaw } = mealPlan
    ? await supabase
        .from("meal_plan_meals")
        .select("id, meal_type, order_index, meal_plan_items(quantity_g, foods(calories_per_100g))")
        .eq("meal_plan_id", mealPlan.id)
        .order("order_index", { ascending: true })
    : { data: null };
  const meals: MealsTileMeal[] = ((mealRowsRaw ?? []) as unknown as MealRow[]).map((m) => ({
    id: m.id,
    mealType: m.meal_type,
    kcal: (m.meal_plan_items ?? []).reduce(
      (sum, item) => sum + ((item.foods?.calories_per_100g ?? 0) * (item.quantity_g ?? 0)) / 100,
      0,
    ),
  }));

  // ---- Training: what does today look like? ----
  let workoutState: TodayWorkoutState = "none";
  let todayDay: TodayWorkoutDay | null = null;
  let weekDone = 0;
  const weekTarget = trainingProfile?.days_per_week ?? 0;

  if (trainingProfile) {
    const { data: program } = await supabase
      .from("user_programs")
      .select("id")
      .eq("training_profile_id", trainingProfile.id)
      .eq("is_active", true)
      .maybeSingle();

    if (program) {
      type ProgramDayRow = {
        id: string;
        day_number: number;
        day_name: string;
        user_program_exercises: { count: number }[];
      };
      const { data: daysRaw } = await supabase
        .from("user_program_days")
        .select("id, day_number, day_name, user_program_exercises(count)")
        .eq("user_program_id", program.id)
        .order("day_number", { ascending: true });
      const days = ((daysRaw ?? []) as unknown as ProgramDayRow[]).map((d) => ({
        id: d.id,
        dayNumber: d.day_number,
        dayName: d.day_name,
        exerciseCount: d.user_program_exercises?.[0]?.count ?? 0,
      }));

      if (days.length > 0) {
        const dayIds = days.map((d) => d.id);
        const [{ data: weekSessions }, { data: openSession }] = await Promise.all([
          supabase
            .from("workout_sessions")
            .select("id, completed_at, user_program_day_id")
            .eq("user_id", user!.id)
            .in("user_program_day_id", dayIds)
            .not("completed_at", "is", null)
            .gte("completed_at", weekStart.toISOString()),
          supabase
            .from("workout_sessions")
            .select("id, user_program_day_id")
            .eq("user_id", user!.id)
            .is("completed_at", null)
            .maybeSingle(),
        ]);

        // Weekly gate: each day counts once per Tunis week, any order.
        const doneDayIds = new Set(
          (weekSessions ?? []).map((s) => s.user_program_day_id).filter(Boolean),
        );
        weekDone = doneDayIds.size;
        const doneToday = (weekSessions ?? []).some(
          (s) => s.completed_at && new Date(s.completed_at) >= todayStart,
        );
        const openDay = openSession?.user_program_day_id
          ? days.find((d) => d.id === openSession.user_program_day_id)
          : undefined;

        if (openDay) {
          todayDay = { id: openDay.id, name: openDay.dayName, exerciseCount: openDay.exerciseCount };
          workoutState = "in_progress";
        } else if (doneToday) {
          workoutState = "done";
        } else if (weekDone >= Math.min(weekTarget || days.length, days.length)) {
          workoutState = "rest";
        } else {
          // First day (by program order) not yet completed this week.
          const next = days.find((d) => !doneDayIds.has(d.id)) ?? days[0];
          todayDay = { id: next.id, name: next.dayName, exerciseCount: next.exerciseCount };
          workoutState = "ready";
        }
      }
    }
  }

  // ---- Check-in state ----
  const todayCheckinRow = (checkins ?? []).find((c) => c.checkin_date === today);
  const todayCheckin: TodayCheckin = todayCheckinRow
    ? {
        weightKg: todayCheckinRow.weight_kg,
        energy: todayCheckinRow.energy,
        sleepHours: todayCheckinRow.sleep_hours,
      }
    : null;
  const lastWeightKg = (checkins ?? []).find((c) => c.weight_kg !== null)?.weight_kg ?? null;
  const streak = checkinStreak((checkins ?? []).map((c) => c.checkin_date));
  // Teaser sparkline: last 14 logged weights, oldest first (checkins are desc).
  const teaserWeights = (checkins ?? [])
    .filter((c) => c.weight_kg !== null)
    .slice(0, 14)
    .map((c) => c.weight_kg as number)
    .reverse();

  const nutritionTarget = macros
    ? { calories: macros.calories, proteinG: macros.protein_g, carbsG: macros.carbs_g, fatG: macros.fat_g }
    : null;

  const qaCards: QaSparkCard[] = shuffled(
    (qaCardsRaw ?? []).map((c) => ({
      id: c.id,
      questionEn: c.question_en,
      questionAr: c.question_ar,
      answerShort: c.answer_short,
      answerShortAr: c.answer_short_ar,
    })),
    5,
  );

  const firstName = profile?.full_name?.split(" ")[0];
  const hasAnsweredQa = (answeredRequests ?? []).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t(locale, "dashboard.greeting")}</p>
          {firstName && <h2 className="text-lg font-extrabold">{firstName}</h2>}
        </div>
        {(streak > 1 || weekTarget > 0) && (
          <div className="flex gap-2">
            {streak > 1 && (
              <span className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-bold">
                <Flame className="h-3.5 w-3.5 text-accent" />
                {streak} {t(locale, "today.streak_label")}
              </span>
            )}
            {weekTarget > 0 && (
              <Link
                href="/review"
                className="rounded-full border border-hairline px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:border-accent/50 hover:text-accent"
              >
                {t(locale, "today.week_label")}: {weekDone}/{weekTarget} {t(locale, "today.sessions_label")}
              </Link>
            )}
          </div>
        )}
      </div>

      {hasAnsweredQa && (
        <Link
          href="/qa"
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 transition-colors hover:bg-accent/15"
        >
          <MessageCircleQuestion className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1 text-sm font-bold">{t(locale, "today.qa_answered")}</span>
          <span className="text-sm font-bold text-accent">{t(locale, "qa.answered_read")} →</span>
        </Link>
      )}

      <Reveal>
        <TodayWorkout locale={locale} state={workoutState} day={todayDay} />
      </Reveal>

      <Reveal delay={0.05}>
        <CheckinCard locale={locale} todayCheckin={todayCheckin} lastWeightKg={lastWeightKg} />
      </Reveal>

      <Reveal delay={0.1}>
        <ProgressTeaser
          locale={locale}
          points={teaserWeights}
          weekDone={weekDone}
          weekTarget={weekTarget}
        />
      </Reveal>

      <Reveal delay={0.15}>
        <div className="grid grid-cols-2 gap-3">
          <NutritionLiveTile locale={locale} target={nutritionTarget} consumed={consumed} />
          <MealsTile locale={locale} meals={meals} />
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <QaSpark locale={locale} cards={qaCards} />
      </Reveal>
    </div>
  );
}
