"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export type WizardStepRenderProps<A> = {
  answers: Partial<A>;
  setAnswer: <K extends keyof A>(key: K, value: A[K]) => void;
};

export type WizardStep<A> = {
  key: keyof A & string;
  title: string;
  render: (props: WizardStepRenderProps<A>) => ReactNode;
  /** Step can't advance until this returns true. Defaults to "value is set". */
  isValid?: (answers: Partial<A>) => boolean;
  /** Deep-dive steps can be skipped entirely (personalization-engine.md §7). */
  optional?: boolean;
  /**
   * Conditional visibility, backing `questionnaire_questions.shown_if` — e.g.
   * `equipment_gym` only appears once `location` includes a gym. Omitted means
   * always visible, so existing callers are unaffected.
   */
  visibleIf?: (answers: Partial<A>) => boolean;
};

/**
 * Generic one-question-per-screen wizard. Big tappable option cards live in
 * each step's `render`, not here — this component only owns navigation,
 * progress, and the answers object.
 */
export function QuestionWizard<A extends Record<string, unknown>>({
  steps,
  onComplete,
  locale,
  initialAnswers,
}: {
  steps: WizardStep<A>[];
  onComplete: (answers: A) => Promise<void>;
  locale: Locale;
  initialAnswers?: Partial<A>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<A>>(initialAnswers ?? {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed every render: answering an earlier question can reveal or hide
  // a later one, so the step list is derived from the answers rather than fixed.
  const visible = steps.filter((s) => (s.visibleIf ? s.visibleIf(answers) : true));
  // Going back and changing an answer can shorten the list past the cursor.
  const safeIndex = Math.min(index, Math.max(0, visible.length - 1));
  const step = visible[safeIndex];
  const isLast = safeIndex === visible.length - 1;
  const valid = step.isValid ? step.isValid(answers) : answers[step.key] !== undefined;

  function setAnswer<K extends keyof A>(key: K, value: A[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function goNext() {
    if (!isLast) {
      setIndex(safeIndex + 1);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onComplete(answers as A);
    } catch {
      setError(t(locale, "common.error"));
      setIsSubmitting(false);
    }
  }

  function goBack() {
    if (safeIndex > 0) setIndex(safeIndex - 1);
  }

  function skip() {
    if (!isLast) setIndex(safeIndex + 1);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={safeIndex + 1} aria-valuemin={1} aria-valuemax={visible.length}>
        {visible.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === safeIndex ? "w-8 bg-accent" : i < safeIndex ? "w-4 bg-accent/50" : "w-4 bg-hairline",
            )}
          />
        ))}
      </div>

      <div key={step.key} className="animate-fade-up flex flex-col gap-6">
        <h2 className="text-center text-2xl font-extrabold tracking-tight">{step.title}</h2>
        {step.render({ answers, setAnswer })}
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={goBack} disabled={safeIndex === 0 || isSubmitting}>
          {locale === "tn" ? "لوراء" : "Back"}
        </Button>
        <div className="flex items-center gap-3">
          {step.optional && !isLast && (
            <Button type="button" variant="secondary" onClick={skip} disabled={isSubmitting}>
              {locale === "tn" ? "أعدّي" : "Skip"}
            </Button>
          )}
          <Button type="button" onClick={goNext} disabled={!valid || isSubmitting}>
            {isSubmitting
              ? locale === "tn"
                ? "قاعد يحسب…"
                : "Working…"
              : isLast
                ? locale === "tn"
                  ? "كمّل"
                  : "Finish"
                : locale === "tn"
                  ? "التالي"
                  : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
