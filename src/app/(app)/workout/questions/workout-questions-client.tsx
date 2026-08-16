"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuestionWizard, type WizardStep } from "@/components/shared/question-wizard";
import { OptionCardGroup } from "@/components/shared/option-card";
import { submitWorkoutQuestions, type WorkoutAnswers } from "@/app/actions/training";
import { isQuestionVisible } from "@/lib/algorithms/split-fill";
import { t, type Locale } from "@/lib/i18n";

export type QuestionRow = {
  id: string;
  order_index: number;
  question_en: string;
  question_ar: string | null;
  type: string;
  options: string[];
  options_ar: string[] | null;
  shown_if: Record<string, string[]> | null;
  max_selections: number | null;
};

/**
 * Options that clear the rest of a multi-select. Every "None"-style option is
 * mutually exclusive with a real answer — "None" plus a knee injury is not a
 * state the engine can act on.
 */
function exclusiveOptionsFor(options: string[]): string[] {
  return options.filter((o) => /^None\b/i.test(o));
}

/**
 * The questionnaire is rendered entirely from `questionnaire_questions` — the
 * questions, their `shown_if` conditionals and `max_selections` caps all come
 * from the database. Adding or rewording a question is a data change, not a
 * code change.
 *
 * Stored answers are always the English option string: it is the canonical
 * value the CHECK constraints and `questionnaire_rules` are keyed on. Arabic
 * is display-only.
 */
export function WorkoutQuestionsClient({
  locale,
  questions,
  isRedo = false,
}: {
  locale: Locale;
  questions: QuestionRow[];
  /** Carried through to the builder so the same rebuild quota check applies. */
  isRedo?: boolean;
}) {
  const router = useRouter();
  const isAr = locale === "tn";

  const steps: WizardStep<WorkoutAnswers>[] = questions.map((q) => {
    const multi = q.type === "multi_select";
    const exclusive = multi ? exclusiveOptionsFor(q.options) : [];

    return {
      key: q.id,
      title: (isAr && q.question_ar) || q.question_en,
      visibleIf: q.shown_if ? (answers) => isQuestionVisible(q.shown_if, answers) : undefined,
      isValid: (answers) => {
        const v = answers[q.id];
        return multi ? Array.isArray(v) && v.length > 0 : typeof v === "string" && v.length > 0;
      },
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          multi={multi}
          maxSelections={q.max_selections ?? undefined}
          exclusiveOptions={exclusive}
          options={q.options.map((opt, i) => ({
            value: opt,
            label: (isAr && q.options_ar?.[i]) || opt,
          }))}
          value={answers[q.id] as string | string[] | undefined}
          onChange={(v) => setAnswer(q.id, v)}
        />
      ),
    };
  });

  async function handleComplete(answers: WorkoutAnswers) {
    const result = await submitWorkoutQuestions(answers);
    if (!result.ok) throw new Error(result.error);
    router.push("/workout/rationale");
  }

  if (steps.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        {isAr ? "الأسئلة مش متوفرة توّا." : "The questionnaire isn't available yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <QuestionWizard steps={steps} onComplete={handleComplete} locale={locale} />
      {/* The escape hatch, on screen the whole way through: somebody who
          realises three questions in that they already know their split
          shouldn't have to finish answering to get out. */}
      <Link
        href={isRedo ? "/workout/build?redo=1" : "/workout/build"}
        className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        {t(locale, "build.switch_to_custom")}
      </Link>
    </div>
  );
}
