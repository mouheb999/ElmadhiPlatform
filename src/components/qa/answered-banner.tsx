"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { markQaAnswerSeen } from "@/app/actions/qa";

export type AnsweredRequest = {
  requestId: string;
  cardId: string;
  questionText: string;
};

/** "Your question was answered" — tapping opens the card and clears the flag. */
export function AnsweredBanner({
  locale,
  answered,
}: {
  locale: Locale;
  answered: AnsweredRequest[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (answered.length === 0) return null;

  function openAnswer(item: AnsweredRequest) {
    startTransition(async () => {
      await markQaAnswerSeen(item.requestId);
      router.push(`/qa/${item.cardId}`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {answered.map((item) => (
        <button
          key={item.requestId}
          type="button"
          onClick={() => openAnswer(item)}
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-start transition-colors hover:bg-accent/15"
        >
          <PartyPopper className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1">
            <span className="block text-sm font-bold">{t(locale, "qa.answered_banner")}</span>
            <span className="block text-sm text-muted">{item.questionText}</span>
          </span>
          <span className="shrink-0 text-sm font-bold text-accent">{t(locale, "qa.answered_read")} →</span>
        </button>
      ))}
    </div>
  );
}
