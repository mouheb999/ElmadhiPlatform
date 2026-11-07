import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Dumbbell, Eye, Moon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pick, t, type Locale } from "@/lib/i18n";
import { illustrationFor } from "@/lib/exercise-illustrations";
import { CardTitleRow } from "@/components/shared/card-title-row";

export type TodayWorkoutState = "none" | "ready" | "in_progress" | "done" | "rest";

export type TodayExercise = {
  nameEn: string;
  nameAr: string | null;
  sets: number;
  repRange: string;
};

export type TodayWorkoutDay = {
  id: string;
  name: string;
  exerciseCount: number;
  /**
   * The day's exercises in program order, when the caller has them. With them
   * the card leads with the first exercise's illustration and lists the rest;
   * without them (the checkout preview's sample day) it is the compact card.
   */
  exercises?: TodayExercise[];
};

/**
 * Today's training, one tap away — the screen's main action.
 *
 * The card leads with the app's own exercise artwork: dark ground, the working
 * muscles lit in the brand's lime. Those illustrations are on-brand already
 * and Today never showed one; a session card that opens on the bench press
 * you are about to do is the single biggest step from "a website with cards"
 * to "a training app". The rest of the day's exercises sit underneath on a
 * shelf that scrolls sideways.
 *
 * `locked` keeps the day and its exercises visible and sends the button into
 * the program instead of the session. Reading today's exercises is free, so on
 * an unpaid account the job here is to get them looking at what they built —
 * the wall for recording a session sits on the session screen, where it is
 * answering a question the user has actually asked by then.
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
  // The title sits inside the card, native-style, with the chevron disc
  // leading to the full program.
  const heading = (
    <CardTitleRow
      title={t(locale, "today.workout_title")}
      href="/workout"
      linkLabel={t(locale, "today.open_plan")}
      trailing={
        day && (state === "ready" || state === "in_progress") ? (
          <span className="text-[15px] text-subtle">
            {day.exerciseCount} {t(locale, "today.exercises")}
          </span>
        ) : null
      }
    />
  );

  if ((state === "ready" || state === "in_progress") && day) {
    const exercises = day.exercises ?? [];
    const lead = exercises[0];
    const leadImage = lead ? illustrationFor(lead.nameEn) : null;
    const leadName = lead ? pick(locale, lead.nameEn, lead.nameAr) : null;

    return (
      <section aria-label={t(locale, "today.workout_title")}>
        <div className="card-surface overflow-hidden">
          <div className="px-5 pb-4 pt-5">{heading}</div>
          {leadImage ? (
            // The illustrations are drawn on a #181818-ish ground; the frame
            // matches it so the image has no visible edge inside the card.
            <div className="relative h-48 bg-[#181818]">
              <Image
                src={leadImage}
                alt={leadName ?? ""}
                fill
                priority
                sizes="(max-width: 640px) 100vw, 640px"
                className="object-cover"
              />
              {state === "in_progress" && (
                <span className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
                  <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-train" />
                  {t(locale, "home.in_progress")}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-train/15 text-train">
                <Dumbbell className="h-5 w-5" />
              </span>
              {state === "in_progress" && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-train" />
                  {t(locale, "home.in_progress")}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
            <div>
              {leadName && <p className="text-[13px] font-semibold text-subtle">{leadName}</p>}
              <h3 className="text-balance text-[21px] font-bold leading-tight tracking-[-0.01em]">{day.name}</h3>
            </div>
            {locked ? (
              <Button asChild className="w-full">
                <Link href="/workout" transitionTypes={["tab"]}>
                  <Eye />
                  {t(locale, "today.see_workout")}
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href={`/workout/session/${day.id}`} transitionTypes={["nav-forward"]}>
                  <Play className="fill-current" />
                  {t(locale, state === "in_progress" ? "today.continue_workout" : "today.start_workout")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {exercises.length > 1 && (
          <div className="mt-5">
            <h3 className="mb-2.5 text-[17px] font-semibold">{t(locale, "home.up_next")}</h3>
            {/* Bleeds to the screen edges so a card can scroll off them, the
                way a native shelf does; scroll-snap lands each card cleanly. */}
            <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4">
              {exercises.map((exercise, i) => {
                const src = illustrationFor(exercise.nameEn);
                return (
                  <li key={`${exercise.nameEn}-${i}`} className="w-[148px] shrink-0 snap-start">
                    <div className="relative h-[100px] overflow-hidden rounded-2xl bg-[#181818]">
                      {src && <Image src={src} alt="" fill sizes="148px" className="object-contain" />}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                      {pick(locale, exercise.nameEn, exercise.nameAr)}
                    </p>
                    <p className="text-[13px] text-subtle" dir="ltr">
                      {exercise.sets} × {exercise.repRange}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  }

  if (state === "done" || state === "rest") {
    const done = state === "done";
    return (
      <section aria-label={t(locale, "today.workout_title")} className="card-surface flex flex-col gap-4 p-5">
        {heading}
        <div className="flex items-center gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${done ? "bg-train/15 text-train" : "bg-sleep/15 text-sleep"}`}
          >
            {done ? <CheckCircle2 className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-snug">
              {t(locale, done ? "today.workout_done" : "today.rest_day")}
            </p>
            <Link href="/workout" transitionTypes={["tab"]} className="press mt-0.5 inline-block text-[15px] text-muted">
              {t(locale, "today.open_plan")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t(locale, "today.workout_title")}>
      <div className="card-surface flex flex-col gap-4 p-5">
        {heading}
        <p className="text-balance text-[17px] font-bold leading-snug">{t(locale, "today.no_program")}</p>
        <Button asChild className="w-full">
          <Link href="/workout/questions" transitionTypes={["nav-forward"]}>
            {t(locale, "today.build_program")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
