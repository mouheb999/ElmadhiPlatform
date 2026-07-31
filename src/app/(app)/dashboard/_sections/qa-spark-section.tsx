import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";
import { QaSpark, type QaSparkCard } from "@/components/dashboard/qa-spark";

/**
 * The "random question" card at the bottom of Today.
 *
 * Suspended because it is the one thing on this page that depends on nothing
 * about the user — it is a shelf of published content, five rows sampled by
 * migration 038's `qa_cards_random`. There was never a reason for it to hold
 * the coaching content above it back.
 *
 * Fails closed to nothing rendered (QaSpark returns null on an empty list) if
 * migration 038 hasn't been applied yet.
 */
export async function QaSparkSection({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("qa_cards_random", { n: 5 });

  const cards: QaSparkCard[] = (data ?? []).map((c) => ({
    id: c.id,
    questionEn: c.question_en,
    questionAr: c.question_ar,
    answerShort: c.answer_short,
    answerShortAr: c.answer_short_ar,
  }));

  return <QaSpark locale={locale} cards={cards} />;
}

/** Matches the card's resting height so the page doesn't reflow under it. */
export function QaSparkSectionSkeleton() {
  return <div className="h-24 w-full animate-pulse rounded-2xl bg-surface" aria-hidden />;
}
