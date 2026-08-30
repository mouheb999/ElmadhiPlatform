import Link from "next/link";
import { CheckCircle2, Dumbbell, Eye, Moon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";

export type TodayWorkoutState = "none" | "ready" | "in_progress" | "done" | "rest";

export type TodayWorkoutDay = {
  id: string;
  name: string;
  exerciseCount: number;
};

/**
 * The Today screen hero: what training looks like *today*, one tap away.
 *
 * `locked` keeps the day and its exercise count visible and sends the button
 * into the program instead of into checkout. Reading today's exercises is free,
 * so the hero's job on an unpaid account is to get them looking at the thing
 * they built — not to interrupt with a price the moment they arrive. What they
 * cannot do is record a session against it, and the wall for that sits on the
 * session screen and in the summary card lower down, where it is answering a
 * question the user has actually asked by then.
 */
export function TodayWorkout({
  locale,
  state,
  day,
  locked = false,
}: {
  locale: Locale;
  state: TodayWorkoutState;
  day: TodayWorkoutDay | null;
  locked?: boolean;
}) {
  const startButton = (href: string, labelKey: "today.start_workout" | "today.continue_workout") =>
    locked ? (
      <Button asChild size="lg" className="mt-2 w-max">
        <Link href="/workout">
          <Eye className="h-5 w-5" />
          {t(locale, "today.see_workout")}
        </Link>
      </Button>
    ) : (
      <Button asChild size="lg" className="mt-2 w-max">
        <Link href={href}>
          <Play className="h-5 w-5" />
          {t(locale, labelKey)}
        </Link>
      </Button>
    );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-6">
      <div className="glow-accent pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col gap-3">
        <span className="w-max rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          {t(locale, "today.workout_title")}
        </span>

        {state === "ready" && day && (
          <>
            <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight">{day.name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Dumbbell className="h-4 w-4" />
              {day.exerciseCount} {t(locale, "today.exercises")}
            </p>
            {startButton(`/workout/session/${day.id}`, "today.start_workout")}
          </>
        )}

        {state === "in_progress" && day && (
          <>
            <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight">{day.name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              {t(locale, "session.other_in_progress")}
            </p>
            {startButton(`/workout/session/${day.id}`, "today.continue_workout")}
          </>
        )}

        {state === "done" && (
          <>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight tracking-tight">
              <CheckCircle2 className="h-7 w-7 text-accent" />
              {t(locale, "today.workout_done")}
            </h1>
            <Link href="/workout" className="text-sm font-bold text-accent hover:underline">
              {t(locale, "today.open_plan")} →
            </Link>
          </>
        )}

        {state === "rest" && (
          <>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight tracking-tight">
              <Moon className="h-6 w-6 text-accent" />
              {t(locale, "today.rest_day")}
            </h1>
            <Link href="/workout" className="text-sm font-bold text-accent hover:underline">
              {t(locale, "today.open_plan")} →
            </Link>
          </>
        )}

        {state === "none" && (
          <>
            <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight">
              {t(locale, "today.no_program")}
            </h1>
            <Button asChild size="lg" className="mt-2 w-max">
              <Link href="/workout/questions">{t(locale, "today.build_program")} →</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
