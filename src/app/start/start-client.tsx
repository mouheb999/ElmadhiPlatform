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
  loadAnswers,
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
  | { kind: "hero" }
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

export function StartClient({ locale }: { locale: Locale }) {
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
      { kind: "hero" },
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

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<FunnelAnswers>>({});
  const [invalid, setInvalid] = useState<string | null>(null);
  const screen = screens[Math.min(index, screens.length - 1)];

  /**
   * The ad parameters, kept before anything else can navigate away.
   *
   * The answers from a previous visit are deliberately NOT loaded here. They
   * live in a cookie, which the server render cannot see, so reading them into
   * state on mount would mean rendering once without them and again with them
   * — a cascading render on the first screen of the funnel, on a phone, on the
   * click we paid for. They are read in `begin()` instead, at the moment the
   * reader asks to start, which is the first moment anything on screen depends
   * on them.
   */
  useEffect(() => {
    captureAttribution();
  }, []);

  /**
   * Record each screen as it is reached.
   *
   * Fire-and-forget, deduplicated per visit by a unique index in the database
   * (migration 054), so back-and-forth does not inflate the funnel. The ref
   * keeps a tab from re-sending the same step on every re-render.
   */
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const step = screen.kind === "hero" ? "landed" : screen.step;
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

  /**
   * Start, or pick up where they left off.
   *
   * Somebody returning to a half-finished funnel should not have to tap past
   * six questions they have already answered — that is the moment they decide
   * this is a form rather than a plan.
   */
  function begin() {
    const stored = loadAnswers();
    setAnswers(stored);
    const firstUnanswered = screens.findIndex(
      (s) => isQuestion(s) && stored[(s as { key: keyof FunnelAnswers }).key] === undefined,
    );
    setIndex(firstUnanswered === -1 ? 1 : firstUnanswered);
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
      {screen.kind !== "hero" && screen.kind !== "building" && screen.kind !== "reveal" && (
        <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-2 pt-4 backdrop-blur">
          <ProgressBar
            locale={locale}
            current={current}
            total={questionCount}
            onBack={index > 0 ? goBack : undefined}
          />
        </div>
      )}

      {screen.kind === "hero" && <Hero locale={locale} onStart={begin} />}

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

      {screen.kind === "building" && <BuildingScreen locale={locale} onDone={goForward} />}

      {screen.kind === "reveal" &&
        (isComplete(answers) ? (
          <PlanReveal locale={locale} answers={answers} onContinue={toCheckout} />
        ) : (
          // Reached with a gap in the answers — a stale cookie from an older
          // version of the funnel, or a reload part-way through. Send them to
          // the first thing that is missing rather than rendering a plan built
          // on undefined.
          <Recover locale={locale} onFix={begin} />
        ))}
    </main>
  );
}

/** The opening screen. One promise, one button, and what it costs to press it. */
function Hero({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-7 py-12">
      <div className="glow-accent pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50vh]" />

      <Logo className="mx-auto h-14" />

      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-balance font-display text-[32px] font-extrabold leading-[1.1] tracking-tight">
          {t(locale, "fn.hero_title")}
        </h1>
        <p className="mx-auto max-w-[36ch] text-balance text-[15px] leading-relaxed text-muted">
          {t(locale, "fn.hero_sub")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onStart}
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent font-display text-base font-bold text-bg shadow-[0_12px_32px_-8px_rgba(192,218,27,0.5)] transition-transform active:scale-[0.98]"
        >
          {t(locale, "fn.hero_cta")}
        </button>
        <p className="text-center text-xs font-bold text-muted">{t(locale, "fn.hero_free")}</p>
      </div>

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
