import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { pick, type Locale } from "@/lib/i18n";
import { QA_ICONS, qaIconKey, qaAccent } from "@/components/qa/qa-icons";

export type QaCardData = {
  id: string;
  categorySlug: string | null;
  questionEn: string | null;
  questionAr: string | null;
  answerShort: string | null;
  answerShortAr: string | null;
  /** Category look, or the card's own override. */
  icon?: string | null;
  accentColor?: string | null;
};

/** One row in the library list — opens the full visual answer card. */
export function QaCard({ locale, card }: { locale: Locale; card: QaCardData }) {
  const Icon = QA_ICONS[qaIconKey(card.icon, card.categorySlug)];
  const accent = qaAccent(card.accentColor);

  return (
    <Link
      href={`/qa/${card.id}`}
      className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-5 transition-colors hover:bg-white/5"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: `${accent}1F`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <div className="font-bold">{pick(locale, card.questionEn, card.questionAr)}</div>
        <p className="line-clamp-2 text-sm text-muted">{pick(locale, card.answerShort, card.answerShortAr)}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted rtl:rotate-180" />
    </Link>
  );
}
