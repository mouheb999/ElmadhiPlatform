"use client";

import { Sparkles } from "lucide-react";
import { ProofPoints, Testimonials } from "@/components/funnel/proof";
import { t, type Locale } from "@/lib/i18n";
import type { FunnelAnswers } from "@/lib/funnel/answers";

/**
 * The screens between the questions.
 *
 * This is the part of the funnel that is doing the selling, and the thing it
 * sells with is the reader's own answers. An interstitial that said "10,000
 * Tunisians trust us" would be a claim they have to take on faith from a page
 * they landed on ninety seconds ago; one that says "14 kg to lose — here is
 * the pace that holds" is arithmetic they watched us do on numbers they typed
 * themselves.
 *
 * Three of them, spaced so that no more than four questions pass without the
 * reader being told what their answers are for. They are also the pacing: an
 * eleven-question form is a chore, and eleven questions broken by three
 * screens that say something back is a conversation.
 */

/** A shared frame, so all three read as the same voice interrupting. */
function Frame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15">
          <Sparkles className="h-[22px] w-[22px] text-accent" />
        </span>
        <h1 className="text-balance font-display text-[26px] font-extrabold leading-tight tracking-tight">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

/**
 * Straight after the target weight, with the gap they just described.
 *
 * The number is theirs, subtracted. Nothing is claimed about how fast it will
 * go — that is the reveal's job, and promising it twice would mean promising
 * it once without the arithmetic to back it.
 */
export function GapInterstitial({
  locale,
  answers,
}: {
  locale: Locale;
  answers: Partial<FunnelAnswers>;
}) {
  const current = answers.weightKg;
  const target = answers.targetWeightKg;
  const gap = current !== undefined && target !== undefined ? target - current : 0;
  const meaningful = Math.abs(gap) >= 1;

  return (
    <Frame title={t(locale, "fn.i1_title")}>
      {meaningful && (
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-[56px] font-extrabold leading-none tabular-nums text-accent">
            <bdi>
              {Math.abs(gap).toFixed(1)} {t(locale, "fn.unit_kg")}
            </bdi>
          </span>
          <span className="text-sm font-bold text-muted">
            {t(locale, gap < 0 ? "fn.i1_gap_lose" : "fn.i1_gap_gain")}
          </span>
        </div>
      )}
      <p className="mx-auto max-w-[34ch] text-balance text-center text-sm leading-relaxed text-muted">
        {t(locale, meaningful ? "fn.i1_body" : "fn.i1_body_same")}
      </p>
    </Frame>
  );
}

/** After the body questions: what is about to be done with them. */
export function MechanismInterstitial({ locale }: { locale: Locale }) {
  return (
    <Frame title={t(locale, "fn.i2_title")}>
      <p className="-mt-2 text-center text-sm text-muted">{t(locale, "fn.i2_sub")}</p>
      <ProofPoints locale={locale} limit={3} />
    </Frame>
  );
}

/**
 * After they name what stopped them last time — answered in one paragraph,
 * about the thing they actually said.
 *
 * A testimonial rides underneath when there is one to show, which is the one
 * place in the funnel where somebody else's experience is the right argument:
 * the reader has just admitted a failure, and the useful reply is that someone
 * like them got past it. It renders nothing while there are no real ones.
 */
const ANSWER = {
  what_to_eat: "fn.ans_what_to_eat",
  no_program: "fn.ans_no_program",
  motivation: "fn.ans_motivation",
  no_time: "fn.ans_no_time",
  stalled: "fn.ans_stalled",
} as const;

export function BlockerInterstitial({
  locale,
  answers,
}: {
  locale: Locale;
  answers: Partial<FunnelAnswers>;
}) {
  const key = answers.blocker ? ANSWER[answers.blocker] : "fn.ans_no_program";
  return (
    <Frame title={t(locale, "fn.i3_title")}>
      <p className="mx-auto max-w-[36ch] text-balance text-center text-sm leading-relaxed text-muted">
        {t(locale, key)}
      </p>
      <Testimonials locale={locale} limit={1} heading={false} />
    </Frame>
  );
}
