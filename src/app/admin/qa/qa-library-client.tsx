"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, EyeOff, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Locale } from "@/lib/i18n";
import { setQaCardPublished, deleteQaCard } from "@/app/actions/qa";

export type LibraryCard = {
  id: string;
  questionEn: string | null;
  questionAr: string | null;
  categoryName: string | null;
  isPublished: boolean;
  /** Set on cards that came from the content file — a re-seed restores them. */
  externalId: string | null;
};

/**
 * The published library, with the two things triage never offered: taking a
 * card back out, and deleting it. Delete asks for a second click rather than
 * a browser confirm, so the destructive path is deliberate but stays in-page.
 */
export function QaLibraryClient({ locale, cards }: { locale: Locale; cards: LibraryCard[] }) {
  const [items, setItems] = useState(cards);
  const [query, setQuery] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((card) =>
      `${card.questionEn ?? ""} ${card.questionAr ?? ""}`.toLowerCase().includes(needle),
    );
  }, [items, query]);

  function togglePublished(card: LibraryCard) {
    setError(null);
    setPendingId(card.id);
    startTransition(async () => {
      const result = await setQaCardPublished(card.id, !card.isPublished);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, isPublished: !card.isPublished } : c)),
      );
    });
  }

  function remove(card: LibraryCard) {
    setError(null);
    setPendingId(card.id);
    startTransition(async () => {
      const result = await deleteQaCard(card.id);
      setPendingId(null);
      setConfirmingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((c) => c.id !== card.id));
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5">
      <div>
        <h2 className="font-bold">{t(locale, "admin.qa_library_title")}</h2>
        <p className="text-sm text-muted">{t(locale, "admin.qa_library_sub")}</p>
      </div>

      <div className="relative">
        <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "admin.qa_library_search")}
          className="ps-11"
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <p className="text-xs text-muted">
        {t(locale, "admin.qa_library_count").replace("{n}", String(filtered.length))}
      </p>

      <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t(locale, "admin.qa_library_empty")}</p>
        ) : (
          filtered.map((card) => {
            const busy = isPending && pendingId === card.id;
            const confirming = confirmingId === card.id;
            return (
              <div
                key={card.id}
                className="flex flex-col gap-2 rounded-2xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold">{card.questionEn ?? card.questionAr}</div>
                  <div className="truncate text-xs text-muted">
                    {card.questionEn && card.questionAr ? card.questionAr : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {card.categoryName && <span>{card.categoryName}</span>}
                    {!card.isPublished && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5">
                        {t(locale, "admin.qa_library_hidden")}
                      </span>
                    )}
                    {card.externalId && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5">{card.externalId}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {confirming ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => remove(card)} disabled={busy}>
                        <Trash2 className="h-4 w-4" />
                        {t(locale, "admin.qa_library_confirm_delete")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)} disabled={busy}>
                        {t(locale, "admin.qa_library_cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => togglePublished(card)}
                        disabled={busy}
                        title={t(locale, card.isPublished ? "admin.qa_library_hide" : "admin.qa_library_show")}
                      >
                        {card.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {t(locale, card.isPublished ? "admin.qa_library_hide" : "admin.qa_library_show")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingId(card.id)}
                        disabled={busy}
                        title={t(locale, "admin.qa_library_delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted">{t(locale, "admin.qa_library_seed_note")}</p>
    </div>
  );
}
