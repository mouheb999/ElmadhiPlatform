"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BuildingScreen } from "@/components/funnel/building";
import {
  BottomAction,
  ChoiceList,
  NumberEntry,
  ProgressBar,
  ScreenBody,
  type Choice,
} from "@/components/funnel/funnel-ui";
import {
  BlockerInterstitial,
  GapInterstitial,
  MechanismInterstitial,
} from "@/components/funnel/interstitial";
import { PlanReveal } from "@/components/funnel/plan-reveal";
import { Logo } from "@/components/layout/logo";
import { recordFunnelStep } from "@/app/actions/funnel";
import { inRange, isComplete, type FunnelAnswers } from "@/lib/funnel/answers";
import {
  captureAttribution,
  rawAttribution,
  saveAnswers,
  visitId,
} from "@/lib/funnel/client-store";
import { dir, t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * /start — the screen an ad points at.
 *
 * It is a questionnaire on purpose. A landing page argues; a questionnaire
 * gets the reader to describe their own problem in their own numbers, and then
 * hands those numbers back as a plan. By the time the price appears they are
 * not being asked "do you want a fitness app" — they are being asked whether
 * they want the plan they just watched get built, which is a question with a
 * much better answer rate.
 *
 * There is no welcome screen. The visitor arrives on question one, because a
 * screen whose only content is a button asking whether they would like to begin
 * is a tap charged against a click we paid for — and, pointed at from the
 * landing page, it was the same headline and the same button twice. The first
 * tap is an answer.
 *
 * Three rules hold the flow together:
 *
 *   1. **No account until the price.** Nothing here writes to a user record,
 *      because there is no user. Answers live in a cookie; the account is
 *      asked for at /checkout, after a plan, after a price — the last possible
 *      moment before money. Asking earlier is the mistake this whole funnel
 *      exists to undo.
 *   2. **Never ask twice.** Every answer is stored, carried into sign-up and
 *      pre-fills the real questionnaire. The reader spends these two minutes
 *      once.
 *   3. **Nothing is claimed that is not computed.** The interstitials talk
 *      about the reader's own answers; the reveal runs the product's own macro
 *      engine. There is no sentence in this funnel that the app cannot keep.
 */

type Screen =
  | {
      kind: "choice";
      step: string;
      key: keyof FunnelAnswers;
      title: StringKey;
      hint?: StringKey;
      choices: Choice[];
    }
  | {
      kind: "number";
      step: string;
      key: "age" | "heightCm" | "weightKg" | "targetWeightKg";
      title: StringKey;
      hint?: StringKey;
      unit: StringKey;
      decimal?: boolean;
    }
  | { kind: "interstitial"; step: string; id: "gap" | "mechanism" | "blocker" }
  | { kind: "building"; step: string }
  | { kind: "reveal"; step: string };

/** True for the screens that count towards the progress bar. */
function isQuestion(screen: Screen): boolean {
  return screen.kind === "choice" || screen.kind === "number";
}

/**
 * Where a visitor should be dropped into the flow.
 *
 * Somebody returning to a half-finished funnel should not have to tap past six
 * questions they have already answered — that is the moment it stops being a
 * plan and becomes a form. A funnel with every answer filled in reopens on the
 * last question rather than the reveal, so the reveal is always something they
 * arrived at, never something that was waiting for them.
 */
function firstUnanswered(screens: Screen[], answers: Partial<FunnelAnswers>): number {
  const found = screens.findIndex(
    (screen) => isQuestion(screen) && answers[(screen as { key: keyof FunnelAnswers }).key] === undefined,
  );
  if (found !== -1) return found;
  const last = screens.map(isQuestion).lastIndexOf(true);
  return last === -1 ? 0 : last;
}

export function StartClient({
  locale,
  initialAnswers,
}: {
  locale: Locale;
  /** The cookie from a previous visit, read on the server. See page.tsx. */
  initialAnswers: Partial<FunnelAnswers>;
}) {
  const router = useRouter();
  const tr = useCallback((key: StringKey) => t(locale, key), [locale]);

  /**
   * The flow.
   *
   * Ordered the way a conversation goes rather than the way a database row is
   * shaped: the goal first, because it is the question they came to answer and
   * the cheapest possible first tap; the personal ones (what stopped you) last,
   * once answering has become a habit. The interstitials sit at the two points
   * where a body-measurement questionnaire starts to feel like paperwork —
   * after the numbers, and after the confession.
   */
  const screens = useMemo<Screen[]>(() => {
    const choice = (values: [string, StringKey, StringKey?][]): Choice[] =>
      values.map(([value, label, sub]) => ({
        value,
        label: tr(label),
        sub: sub ? tr(sub) : undefined,
      }));

    return [
      {
        kind: "choice",
        step: "q_goal",
        key: "goal",
        title: "fn.q_goal",
        hint: "fn.q_goal_hint",
        choices: choice([
          ["lose_fat", "diet.goal_lose_fat", "fn.goal_lose_fat_sub"],
          ["build_muscle", "diet.goal_build_muscle", "fn.goal_build_muscle_sub"],
          ["recomp", "diet.goal_recomp", "fn.goal_recomp_sub"],
          ["maintain", "diet.goal_maintain", "fn.goal_maintain_sub"],
        ]),
      },
      {
        kind: "choice",
        step: "q_gender",
        key: "gender",
        title: "fn.q_gender",
        hint: "fn.q_gender_hint",
        choices: choice([
          ["male", "diet.gender_male"],
          ["female", "diet.gender_female"],
        ]),
      },
      { kind: "number", step: "q_age", key: "age", title: "fn.q_age", unit: "fn.unit_years" },
      { kind: "number", step: "q_height", key: "heightCm", title: "fn.q_height", unit: "fn.unit_cm" },
      {
        kind: "number",
        step: "q_weight",
        key: "weightKg",
        title: "fn.q_weight",
        hint: "fn.q_weight_hint",
        unit: "fn.unit_kg",
        decimal: true,
      },
      {
        kind: "number",
        step: "q_target",
        key: "targetWeightKg",
        title: "fn.q_target",
        hint: "fn.q_target_hint",
        unit: "fn.unit_kg",
        decimal: true,
      },
      { kind: "interstitial", step: "i_gap", id: "gap" },
      {
        kind: "choice",
        step: "q_days",
        key: "trainingDays",
        title: "fn.q_days",
        hint: "fn.q_days_hint",
        choices: choice([
          ["1_2", "diet.td_1_2"],
          ["3_4", "diet.td_3_4"],
          ["5_6", "diet.td_5_6"],
          ["7", "diet.td_7"],
          ["0", "diet.td_0"],
        ]),
      },
      {
        kind: "choice",
        step: "q_activity",
        key: "activityLevel",
        title: "fn.q_activity",
        hint: "fn.q_activity_hint",
        choices: choice([
          ["sedentary", "diet.activity_sedentary"],
          ["light", "diet.activity_light"],
          ["moderate", "diet.activity_moderate"],
          ["active", "diet.activity_active"],
          ["very_active", "diet.activity_very_active"],
        ]),
      },
      { kind: "interstitial", step: "i_mechanism", id: "mechanism" },
      {
        kind: "choice",
        step: "q_experience",
        key: "experience",
        title: "fn.q_experience",
        choices: choice([
          ["new", "fn.exp_new", "fn.exp_new_sub"],
          ["returning", "fn.exp_returning", "fn.exp_returning_sub"],
          ["consistent", "fn.exp_consistent", "fn.exp_consistent_sub"],
        ]),
      },
      {
        kind: "choice",
        step: "q_meals",
        key: "mealsPerDay",
        title: "fn.q_meals",
        hint: "fn.q_meals_hint",
        choices: choice([
          ["3", "fn.meals_3"],
          ["4", "fn.meals_4"],
          ["5", "fn.meals_5"],
        ]),
      },
      {
        kind: "choice",
        step: "q_blocker",
        key: "blocker",
        title: "fn.q_blocker",
        hint: "fn.q_blocker_hint",
        choices: choice([
          ["what_to_eat", "fn.blk_what_to_eat"],
          ["no_program", "fn.blk_no_program"],
          ["motivation", "fn.blk_motivation"],
          ["no_time", "fn.blk_no_time"],
          ["stalled", "fn.blk_stalled"],
        ]),
      },
      { kind: "interstitial", step: "i_blocker", id: "blocker" },
      { kind: "building", step: "building" },
      { kind: "reveal", step: "reveal" },
    ];
  }, [tr]);

  const questionCount = screens.filter(isQuestion).length;

  // Both seeded from the server-read cookie, so the first paint is already the
  // right question with the right cards lit — no flash of question one.
  const [index, setIndex] = useState(() => firstUnanswered(screens, initialAnswers));
  const [answers, setAnswers] = useState<Partial<FunnelAnswers>>(initialAnswers);
  const [invalid, setInvalid] = useState<string | null>(null);
  const screen = screens[Math.min(index, screens.length - 1)];

  /**
   * The ad parameters, kept before anything else can navigate away, and the
   * visit itself.
   *
   * `landed` is recorded here rather than by the screen effect below, because
   * there is no longer a screen that means "arrived but has not answered
   * anything". It is the denominator every other step in the funnel is read
   * against: without it, a campaign's drop-off starts at question one and the
   * people who bounced before answering are invisible.
   */
  useEffect(() => {
    captureAttribution();
    void recordFunnelStep(visitId(), "landed", rawAttribution(), locale);
  }, [locale]);

  /**
   * Record each screen as it is reached.
   *
   * Fire-and-forget, deduplicated per visit by a unique index in the database
   * (migration 054), so back-and-forth does not inflate the funnel. The ref
   * keeps a tab from re-sending the same step on every re-render.
   */
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const step = screen.step;
    if (sent.current.has(step)) return;
    sent.current.add(step);
    void recordFunnelStep(visitId(), step, rawAttribution(), locale);
  }, [screen, locale]);

  /** Every answer is written through, so a closed tab does not lose the lot. */
  function commit(next: Partial<FunnelAnswers>) {
    setAnswers(next);
    saveAnswers(next);
  }

  function goForward() {
    setInvalid(null);
    setIndex((i) => Math.min(i + 1, screens.length - 1));
    window.scrollTo({ top: 0 });
  }

  function goBack() {
    setInvalid(null);
    setIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  }

  /** Back to whatever is still missing. Only the recovery screen needs this. */
  function resume() {
    setInvalid(null);
    setIndex(firstUnanswered(screens, answers));
    window.scrollTo({ top: 0 });
  }

  function pickChoice(key: keyof FunnelAnswers, value: string) {
    // `mealsPerDay` is the one card-answered question the plan reads as a
    // number. Everything else is stored as the string the questionnaire uses.
    const stored = key === "mealsPerDay" ? Number(value) : value;
    commit({ ...answers, [key]: stored } as Partial<FunnelAnswers>);
    // A beat, so the card they tapped lights up before the screen moves. The
    // selection is the confirmation; without the pause the tap feels like it
    // went somewhere else.
    setTimeout(goForward, 180);
  }

  function submitNumber(key: "age" | "heightCm" | "weightKg" | "targetWeightKg") {
    if (!inRange(key, answers[key])) {
      setInvalid(tr("fn.out_of_range"));
      return;
    }
    goForward();
  }

  /**
   * On to the price.
   *
   * No plan id and no account — /checkout opens on its own plan grid and asks
   * for the account when one is chosen. What travels is the cookie, which is
   * what lets checkout restate the plan they just watched get built.
   */
  function toCheckout() {
    void recordFunnelStep(visitId(), "to_checkout", rawAttribution(), locale);
    router.push("/checkout?from=funnel");
  }

  // The progress bar counts questions answered, not screens seen: an
  // interstitial is not work the reader has to do, and a bar that jumps
  // forward on a screen with no question on it reads as padding.
  const answeredBefore = screens.slice(0, index).filter(isQuestion).length;
  const current = screen.kind === "reveal" || screen.kind === "building" ? questionCount : answeredBefore;

  return (
    <main
      dir={dir(locale)}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4"
    >
      {/* No progress bar on the reveal. The questions are over; that screen is
          a sales page, and a "11/11" strip with a back arrow on it invites the
          reader to walk backwards into the loading animation they just sat
          through. */}
      {screen.kind !== "building" && screen.kind !== "reveal" && (
        <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/95 px-4 pb-2 pt-4 backdrop-blur">
          {/* The one thing the deleted welcome screen was carrying that the
              questionnaire could not say for itself. An ad click that lands on
              a bare question has no confirmation it reached the thing it was
              sold — the mark is small, constant across every screen, and does
              not move when the question does. */}
          <Logo className="mx-auto h-7" />
          <ProgressBar
            locale={locale}
            current={current}
            total={questionCount}
            onBack={index > 0 ? goBack : undefined}
          />
        </div>
      )}

      {screen.kind === "choice" && (
        <ScreenBody title={tr(screen.title)} hint={screen.hint ? tr(screen.hint) : undefined}>
          <ChoiceList
            choices={screen.choices}
            value={answers[screen.key] !== undefined ? String(answers[screen.key]) : undefined}
            onPick={(value) => pickChoice(screen.key, value)}
          />
        </ScreenBody>
      )}

      {screen.kind === "number" && (
        <>
          <ScreenBody title={tr(screen.title)} hint={screen.hint ? tr(screen.hint) : undefined}>
            {/* Keyed, so moving between two number questions remounts the
                field and its draft rather than carrying the last answer's
                text across. */}
            <NumberEntry
              key={screen.key}
              value={answers[screen.key]}
              unit={tr(screen.unit)}
              decimal={screen.decimal}
              invalid={invalid}
              onChange={(value) => {
                setInvalid(null);
                commit({ ...answers, [screen.key]: value });
              }}
              onSubmit={() => submitNumber(screen.key)}
            />
          </ScreenBody>
          <BottomAction
            locale={locale}
            label={tr("fn.next")}
            disabled={!inRange(screen.key, answers[screen.key])}
            onClick={() => submitNumber(screen.key)}
          />
        </>
      )}

      {screen.kind === "interstitial" && (
        <>
          {screen.id === "gap" && <GapInterstitial locale={locale} answers={answers} />}
          {screen.id === "mechanism" && <MechanismInterstitial locale={locale} />}
          {screen.id === "blocker" && <BlockerInterstitial locale={locale} answers={answers} />}
          <BottomAction locale={locale} label={tr("fn.next")} onClick={goForward} />
        </>
      )}

      {index === 0 && <OpeningFooter locale={locale} />}

      {screen.kind === "building" && <BuildingScreen locale={locale} onDone={goForward} />}

      {screen.kind === "reveal" &&
        (isComplete(answers) ? (
          <PlanReveal locale={locale} answers={answers} onContinue={toCheckout} />
        ) : (
          // Reached with a gap in the answers — a stale cookie from an older
          // version of the funnel, or a reload part-way through. Send them to
          // the first thing that is missing rather than rendering a plan built
          // on undefined.
          <Recover locale={locale} onFix={resume} />
        ))}
    </main>
  );
}

/**
 * What the welcome screen used to carry, under the first question.
 *
 * Two things on it were worth keeping and neither needed a screen. The price —
 * nothing, no account, no card — answers the question a stranger asks before
 * the first tap, so it sits where they are about to tap. The sign-in link is
 * for the customer who followed an ad to a product they already pay for, and
 * without it their only way back in is the browser's back button.
 *
 * Only under question one: past that they have started, and a way out of the
 * funnel under every question is an invitation to take it.
 */
function OpeningFooter({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-2 pb-8 pt-2">
      <p className="text-center text-xs font-bold text-muted">{t(locale, "fn.hero_free")}</p>
      <p className="text-center text-sm text-muted">
        {t(locale, "fn.hero_signin")}{" "}
        <Link href="/login" className="font-bold text-accent hover:underline">
          {t(locale, "login.sign_in_link")}
        </Link>
      </p>
    </div>
  );
}

function Recover({ locale, onFix }: { locale: Locale; onFix: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <p className="text-sm text-muted">{t(locale, "fn.out_of_range")}</p>
      <button
        type="button"
        onClick={onFix}
        className="h-12 rounded-full bg-accent px-6 font-display font-bold text-bg"
      >
        {t(locale, "fn.next")}
      </button>
    </div>
  );
}
