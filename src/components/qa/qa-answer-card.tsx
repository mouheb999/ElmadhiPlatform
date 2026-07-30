import { Lightbulb, ClipboardCheck, TriangleAlert, Star, ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { QA_ICONS, qaIconKey, qaAccent } from "@/components/qa/qa-icons";

export type QaAnswerCardData = {
  question: string;
  shortAnswer: string;
  science: string | null;
  practical: string | null;
  mistake: string | null;
  tip: string | null;
  warning: string | null;
  longMd: string | null;
  difficultyLevel: string | null;
  readTime: string | null;
  categoryLabel: string | null;
  icon: string | null;
  accentColor: string | null;
};

const LEVEL_KEY: Record<string, StringKey> = {
  Beginner: "qa.level_beginner",
  Intermediate: "qa.level_intermediate",
  Advanced: "qa.level_advanced",
  Safety: "qa.level_safety",
};

/** "30-45 sec" reads as "30-45 ثانية" in Tunisian; the numbers stay put. */
function readTimeLabel(locale: Locale, raw: string): string {
  if (locale !== "tn") return raw;
  return raw.replace(/\s*sec(?:onds?)?\b/i, ` ${t(locale, "qa.seconds")}`);
}

/** One labelled block. Renders nothing when the card has no text for it. */
function Block({
  label,
  icon: Icon,
  text,
  className,
}: {
  label: string;
  icon: typeof Lightbulb;
  text: string | null;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-2 text-xs font-bold text-muted">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/**
 * The Q&A answer as a coaching card: labelled blocks instead of one paragraph,
 * tinted with its category's accent. Everything below the quick answer is
 * optional — a card that only has a question and an answer renders as those two.
 */
export function QaAnswerCard({ locale, card }: { locale: Locale; card: QaAnswerCardData }) {
  const accent = qaAccent(card.accentColor);
  const Icon = QA_ICONS[qaIconKey(card.icon)];
  const levelKey = card.difficultyLevel ? LEVEL_KEY[card.difficultyLevel] : undefined;

  return (
    <article
      className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {card.categoryLabel && (
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: `${accent}1F`, color: accent }}
              >
                {card.categoryLabel}
              </span>
            )}
          </div>
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
            style={{ backgroundColor: `${accent}1F`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div>
          <div className="mb-1 text-xs font-bold text-muted">{t(locale, "qa.block_question")}</div>
          <h1 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">{card.question}</h1>
        </div>

        <div className="rounded-2xl bg-bg/60 p-4">
          <div className="mb-1 text-xs font-bold text-muted">{t(locale, "qa.block_short_answer")}</div>
          <p className="text-base font-semibold leading-relaxed">{card.shortAnswer}</p>
        </div>

        <Block label={t(locale, "qa.block_science")} icon={Lightbulb} text={card.science} />
        <Block label={t(locale, "qa.block_practical")} icon={ClipboardCheck} text={card.practical} />

        {card.mistake && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-red-300">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {t(locale, "qa.block_mistake")}
            </div>
            <p className="text-sm leading-relaxed text-red-100">{card.mistake}</p>
          </div>
        )}

        {card.tip && (
          <div className="border-s-2 ps-4" style={{ borderInlineStartColor: accent }}>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold" style={{ color: accent }}>
              <Star className="h-4 w-4 shrink-0" />
              {t(locale, "qa.block_tip")}
            </div>
            <p className="text-sm leading-relaxed">{card.tip}</p>
          </div>
        )}

        {card.warning && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {t(locale, "qa.block_warning")}
            </div>
            <p className="text-sm leading-relaxed text-amber-100">{card.warning}</p>
          </div>
        )}

        {card.longMd && (
          <div>
            <div className="mb-1 text-xs font-bold text-muted">{t(locale, "qa.block_more")}</div>
            <div className="prose prose-invert max-w-none text-sm leading-relaxed text-muted">
              <ReactMarkdown>{card.longMd}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {(levelKey || card.readTime) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3 text-xs text-muted sm:px-6">
          {levelKey && (
            <span>
              {t(locale, "qa.level")}: {t(locale, levelKey)}
            </span>
          )}
          {card.readTime && (
            <span>
              {t(locale, "qa.read_time")}: {readTimeLabel(locale, card.readTime)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
