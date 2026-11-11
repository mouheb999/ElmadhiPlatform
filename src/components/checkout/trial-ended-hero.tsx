import { Dumbbell, Flag, Scale, Utensils } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/** What the member did during the free days, and where their plan is headed. */
export type TrialRecap = {
  /** Signed kg the plan aims for over twelve weeks; null when it is not a scale plan. */
  goalDeltaKg: number | null;
  /** The twelve-week stop, already formatted ("1 February"). */
  goalDate: string | null;
  meals: number;
  sessions: number;
  weighIns: number;
};

/**
 * The screen a member meets when the free days run out.
 *
 * It used to be the price page with a line above it: "your free days are
 * over". That is a closed door with a tariff on it. The person reading it has
 * spent three days inside the product — they have a plan with their own
 * numbers in it, and most of them have logged something — and the page spoke
 * to them as if they were a stranger.
 *
 * So it starts from what is theirs:
 *
 *   - **The goal, with its date.** The same number the questionnaire gave them
 *     and Progress has been showing: "−6.9 kg by 1 February". It is the reason
 *     they signed up, restated at the moment they decide whether to continue.
 *   - **What they already did.** Meals logged, sessions trained, weigh-ins —
 *     counted from their own rows, shown only when there is something to
 *     count. It says the three days were a start, not a sample.
 *   - **That it is all still there.** Nobody pays to start over.
 *
 * And it names the thing being sold. Not "3 months of access" but a 90-day
 * challenge: a goal, a deadline and the tools to hit it. Ninety days is also
 * simply how long the plan above takes, which is why the three-month term is
 * the one recommended underneath.
 *
 * Nothing here is invented. No countdown, no "only today", no result nobody
 * measured. Every figure is the member's own.
 */
export function TrialEndedHero({ locale, recap }: { locale: Locale; recap: TrialRecap | null }) {
  const kg = t(locale, "fn.unit_kg");
  const hasGoal = recap?.goalDeltaKg != null && Math.abs(recap.goalDeltaKg) >= 0.5 && recap.goalDate;

  const done = recap
    ? [
        { icon: Utensils, count: recap.meals, one: "te.meal", many: "te.meals" } as const,
        { icon: Dumbbell, count: recap.sessions, one: "te.session", many: "te.sessions" } as const,
        { icon: Scale, count: recap.weighIns, one: "te.weigh_in", many: "te.weigh_ins" } as const,
      ].filter((item) => item.count > 0)
    : [];

  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-accent/45 bg-gradient-to-b from-accent/[0.14] via-surface to-surface p-5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
        <Flag className="h-3.5 w-3.5" strokeWidth={2.6} />
        {t(locale, "te.eyebrow")}
      </span>

      <h1 className="text-balance text-[28px] font-extrabold leading-[1.12] tracking-[-0.02em]">
        {t(locale, "te.title")}
      </h1>

      {hasGoal && recap && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-num text-[36px] font-bold leading-none text-accent">
            <bdi>
              <span dir="ltr">
                {recap.goalDeltaKg! < 0 ? "−" : "+"}
                {Math.abs(recap.goalDeltaKg!).toFixed(1)}
              </span>{" "}
              <span className="text-[18px]">{kg}</span>
            </bdi>
          </span>
          <span className="text-[15px] font-semibold text-muted">
            {t(locale, "fn.r_by")} <bdi className="text-ink">{recap.goalDate}</bdi>
          </span>
        </p>
      )}

      {/* What they did in the free days. Hidden entirely when it is nothing:
          "0 meals logged" is an accusation, not a recap. */}
      {done.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {done.map(({ icon: Icon, count, one, many }) => (
            <li
              key={one}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-semibold"
            >
              <Icon className="h-4 w-4 text-accent" strokeWidth={2.2} />
              <bdi>{count}</bdi> {t(locale, count === 1 ? one : many)}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[14px] leading-snug text-muted">{t(locale, "te.saved")}</p>
    </section>
  );
}
