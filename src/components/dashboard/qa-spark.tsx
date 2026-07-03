"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, RotateCw } from "lucide-react";
import { pick, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type QaSparkCard = {
  id: string;
  questionEn: string | null;
  questionAr: string | null;
  answerShort: string;
  answerShortAr: string | null;
};

/**
 * Dashboard "random question" pop-up — replaces the fabricated "coach
 * insight" concept with something the app can actually back: a real
 * qa_cards row, with a shuffle through a small server-picked set.
 */
export function QaSpark({ locale, cards }: { locale: Locale; cards: QaSparkCard[] }) {
  const [index, setIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);

  if (cards.length === 0) return null;
  const card = cards[index % cards.length];

  function shuffle() {
    setSpinning(true);
    setIndex((i) => (i + 1) % cards.length);
    setTimeout(() => setSpinning(false), 300);
  }

  return (
    <div className="rounded-2xl border border-dashed border-accent/35 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t(locale, "qa.spark_eyebrow")}
          </span>
        </div>
        <button
          type="button"
          onClick={shuffle}
          aria-label={t(locale, "qa.another")}
          className="grid h-7 w-7 place-items-center rounded-full border border-hairline text-muted hover:text-ink"
        >
          <RotateCw className={cn("h-3.5 w-3.5 transition-transform duration-300", spinning && "rotate-180")} />
        </button>
      </div>

      <p className={cn("mt-3 text-sm font-bold leading-snug transition-opacity duration-150", spinning && "opacity-0")}>
        {pick(locale, card.questionEn, card.questionAr)}
      </p>
      <p className={cn("mt-1.5 text-xs leading-relaxed text-muted transition-opacity duration-150", spinning && "opacity-0")}>
        {pick(locale, card.answerShort, card.answerShortAr)}
      </p>

      <Link href={`/qa/${card.id}`} className="mt-3 inline-block text-xs font-bold text-accent">
        {t(locale, "qa.open_answer")} →
      </Link>
    </div>
  );
}
