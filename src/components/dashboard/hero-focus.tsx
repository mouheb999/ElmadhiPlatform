import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t, pick, type Locale } from "@/lib/i18n";
import type { TrainingTileProgram } from "@/components/dashboard/training-tile";

type Bilingual = { en: string; ar: string };

export function HeroFocus({
  locale,
  dietActive,
  workoutActive,
  program,
  calorieTarget,
}: {
  locale: Locale;
  dietActive: boolean;
  workoutActive: boolean;
  program: TrainingTileProgram | null;
  calorieTarget: number | null;
}) {
  let eyebrowKey: "dashboard.hero_eyebrow_plan" | "dashboard.hero_eyebrow_setup" = "dashboard.hero_eyebrow_setup";
  let headline: Bilingual;
  let meta: Bilingual;
  let ctaHref: string;
  let ctaLabel: string;

  if (workoutActive && program) {
    eyebrowKey = "dashboard.hero_eyebrow_plan";
    headline = { en: program.name, ar: program.name };
    meta = calorieTarget
      ? {
          en: `${program.daysPerWeek} days/week · ${calorieTarget} kcal/day target`,
          ar: `${program.daysPerWeek} أيام/الجمعة · هدف ${calorieTarget} سعرة/يوم`,
        }
      : {
          en: `${program.daysPerWeek} days/week`,
          ar: `${program.daysPerWeek} أيام/الجمعة`,
        };
    ctaHref = "/workout/program";
    ctaLabel = locale === "tn" ? "شوف البرنامج" : "View your program";
  } else if (dietActive && !workoutActive) {
    headline = { en: "Your diet is set — build your workout next", ar: "الأكل متاعك جاهز — يالله نبنيو التمرين" };
    meta = { en: "Six quick questions, done in a minute.", ar: "ستة أسئلة ساهلة، دقيقة وتكمل." };
    ctaHref = "/workout/questions";
    ctaLabel = locale === "tn" ? "ابدا التمرين" : "Start your workout";
  } else if (workoutActive && !dietActive) {
    headline = { en: "Your workout is set — build your diet next", ar: "التمرين متاعك جاهز — يالله نبنيو الأكل" };
    meta = { en: "A few simple questions, no jargon.", ar: "شويّة أسئلة ساهلة، بلا تعقيد." };
    ctaHref = "/diet/questions";
    ctaLabel = locale === "tn" ? "ابدا الأكل" : "Start your diet";
  } else {
    headline = { en: "Let's build your plan", ar: "يالله نبنيو البرنامج متاعك" };
    meta = {
      en: "Answer a few questions for your diet and workout — a few minutes each.",
      ar: "جاوب على شويّة أسئلة للأكل والتمرين — دقايق معدودة لكل وحدة.",
    };
    ctaHref = "/diet/questions";
    ctaLabel = t(locale, "dashboard.cta_start");
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-6">
      <div className="glow-accent pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col gap-3">
        <span className="w-max rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          {t(locale, eyebrowKey)}
        </span>
        <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight">
          {pick(locale, headline.en, headline.ar)}
        </h1>
        <p className="text-sm text-muted">{pick(locale, meta.en, meta.ar)}</p>
        <Button asChild size="lg" className="mt-2 w-max">
          <Link href={ctaHref}>{ctaLabel} →</Link>
        </Button>
      </div>
    </div>
  );
}
