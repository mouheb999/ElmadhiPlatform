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
  answerShort: string | null;
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

  // The library's colour is gold (the learn token), so a
  // card from it is recognisable as "from the library" before it is read.
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-learn/15 text-learn">
            <HelpCircle className="h-[18px] w-[18px]" />
          </span>
          <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{t(locale, "qa.spark_eyebrow")}</h2>
        </div>
        <button
          type="button"
          onClick={shuffle}
          aria-label={t(locale, "qa.another")}
          className="press grid h-9 w-9 place-items-center rounded-full bg-surface2 text-[#D4D4D8]"
        >
          <RotateCw className={cn("h-4 w-4 transition-transform duration-300", spinning && "rotate-180")} />
        </button>
      </div>

      <p className={cn("mt-3.5 text-[17px] font-semibold leading-snug transition-opacity duration-150", spinning && "opacity-0")}>
        {pick(locale, card.questionEn, card.questionAr)}
      </p>
      <p className={cn("mt-1.5 text-[15px] leading-relaxed text-muted transition-opacity duration-150", spinning && "opacity-0")}>
        {pick(locale, card.answerShort, card.answerShortAr)}
      </p>

      <Link
        href={`/qa/${card.id}`}
        transitionTypes={["nav-forward"]}
        className="press mt-3 inline-block text-[15px] font-semibold text-learn"
      >
        {t(locale, "qa.open_answer")}
      </Link>
    </div>
  );
}
