"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, MessageCircleQuestion } from "lucide-react";
import { QaCard, type QaCardData } from "@/components/qa/qa-card";
import { qaAccent } from "@/components/qa/qa-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pick, t, type Locale } from "@/lib/i18n";
import { submitQaRequest } from "@/app/actions/qa";
import type { QaQuota } from "@/lib/qa";

export type QaCategoryData = {
  slug: string;
  nameEn: string | null;
  nameAr: string | null;
  accentColor?: string | null;
};

function fillCounts(template: string, values: { n?: number; total: number }): string {
  return template.replace("{n}", String(values.n ?? 0)).replace("{total}", String(values.total));
}

export function QaFeed({
  locale,
  categories,
  cards,
  quota,
}: {
  locale: Locale;
  categories: QaCategoryData[];
  cards: QaCardData[];
  /** null when signed out — the ask box is hidden in that case. */
  quota: QaQuota | null;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [askText, setAskText] = useState("");
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept in state so the counter drops the moment a question is sent.
  const [remaining, setRemaining] = useState(quota?.remaining ?? 0);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return cards.filter((card) => {
      if (activeCategory && card.categorySlug !== activeCategory) return false;
      if (query.trim()) {
        const haystack = `${card.questionEn ?? ""} ${card.questionAr ?? ""}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [cards, activeCategory, query]);

  function handleAsk() {
    if (!askText.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await submitQaRequest(askText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRemaining(result.data.remaining);
      setAsked(true);
      setAskText("");
    });
  }

  const outOfQuestions = quota !== null && remaining <= 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "qa.title")}</h1>
        <p className="text-muted">{t(locale, "qa.subtitle")}</p>
      </div>

      <div className="relative">
        <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(locale, "qa.search")} className="ps-11" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={
            activeCategory === null
              ? "shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-bold text-bg"
              : "shrink-0 rounded-full border border-hairline px-4 py-2 text-sm font-bold text-muted hover:text-ink"
          }
        >
          {t(locale, "qa.category_all")}
        </button>
        {categories.map((cat) => {
          const active = activeCategory === cat.slug;
          const accent = qaAccent(cat.accentColor);
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setActiveCategory(cat.slug)}
              style={active ? { backgroundColor: accent } : { color: accent }}
              className={
                active
                  ? "shrink-0 rounded-full px-4 py-2 text-sm font-bold text-bg"
                  : "shrink-0 rounded-full border border-hairline px-4 py-2 text-sm font-bold hover:bg-white/5"
              }
            >
              {pick(locale, cat.nameEn, cat.nameAr)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted">{t(locale, "qa.empty")}</p>
        ) : (
          filtered.map((card) => <QaCard key={card.id} locale={locale} card={card} />)
        )}
      </div>

      {quota && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-hairline p-5">
          <div className="flex items-center gap-3">
            <MessageCircleQuestion className="h-6 w-6 shrink-0 text-accent" />
            <div>
              <div className="font-bold">{t(locale, "qa.ask_title")}</div>
              <div className="text-sm text-muted">{t(locale, "qa.ask_sub")}</div>
            </div>
          </div>

          {asked && <p className="text-sm text-accent">{t(locale, "qa.ask_sent")}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {outOfQuestions ? (
            <p className="text-sm text-muted">
              {fillCounts(t(locale, "qa.quota_none"), { total: quota.limit })}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  placeholder={t(locale, "qa.ask_placeholder")}
                />
                <Button type="button" onClick={handleAsk} disabled={isPending || !askText.trim()}>
                  {t(locale, "qa.ask_cta")}
                </Button>
              </div>
              <p className="text-xs text-muted">
                {fillCounts(t(locale, "qa.quota_left"), { n: remaining, total: quota.limit })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
