"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, Search, X } from "lucide-react";
import { publishCopy, type CopyEdit } from "@/app/actions/copy";
import {
  STRING_KEYS,
  defaultCopy,
  t,
  type Locale,
  type StringKey,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Enough to scan, few enough that typing stays responsive over ~1500 keys. */
const MAX_RESULTS = 25;

type Draft = Record<string, string>; // "<locale>:<key>" -> edited value

/**
 * The admin copy editor: search any string in the product, rewrite it in
 * English and Tunisian, publish to Postgres.
 *
 * Search rather than click-the-page. In-place editing needs every rendered
 * string to carry its key through the DOM, which would mean touching ~1500
 * call sites for partial coverage — whereas searching the catalogue reaches
 * every string in the product on day one, including the ones on screens the
 * admin is not currently looking at (emails, error states, the Arabic side of
 * a page being viewed in English).
 *
 * Both locales are edited side by side on purpose. Renaming something in
 * English and leaving the Arabic saying the old thing is the obvious way for a
 * bilingual product to drift, and it is invisible to whoever made the edit.
 */
export function AdminCopyBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirtyCount = Object.keys(draft).length;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return STRING_KEYS.slice(0, MAX_RESULTS);
    const hits: StringKey[] = [];
    for (const key of STRING_KEYS) {
      // Match the key itself or either translation, so an admin can find a
      // string by the words they can see on screen rather than by its id.
      if (
        key.toLowerCase().includes(needle) ||
        defaultCopy("en", key).toLowerCase().includes(needle) ||
        defaultCopy("tn", key).includes(query.trim())
      ) {
        hits.push(key);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  }, [query]);

  function edit(key: StringKey, editLocale: Locale, value: string) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [`${editLocale}:${key}`]: value }));
  }

  function revert(key: StringKey, editLocale: Locale) {
    setSaved(false);
    // Empty string is the reset signal the action understands: it deletes the
    // row, so the string falls back to whatever i18n.ts ships.
    setDraft((prev) => ({ ...prev, [`${editLocale}:${key}`]: "" }));
  }

  function current(key: StringKey, editLocale: Locale): string {
    const draftKey = `${editLocale}:${key}`;
    if (draftKey in draft) return draft[draftKey];
    return t(editLocale, key);
  }

  function publish() {
    setError(null);
    const edits: CopyEdit[] = Object.entries(draft).map(([composite, value]) => {
      const separator = composite.indexOf(":");
      return {
        locale: composite.slice(0, separator),
        key: composite.slice(separator + 1),
        value,
      };
    });
    startTransition(async () => {
      const result = await publishCopy(edits);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft({});
      setSaved(true);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] end-4 z-40 flex items-center gap-2 rounded-full border border-hairline bg-surface/95 px-4 py-2.5 font-display text-sm font-bold text-ink shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur hover:border-accent/50"
      >
        <Pencil className="h-4 w-4 text-accent" />
        Edit copy
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-surface/98 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-display font-extrabold">
            <Pencil className="h-4 w-4 text-accent" />
            Edit copy
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex items-center gap-2 rounded-2xl border border-hairline bg-bg px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the text you want to change…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/60"
          />
        </label>

        <div className="flex flex-col gap-3">
          {results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">Nothing matches that.</p>
          )}
          {results.map((key) => {
            const touched = `en:${key}` in draft || `tn:${key}` in draft;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-3",
                  touched ? "border-accent/50 bg-accent/[0.05]" : "border-hairline bg-bg",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-[11px] text-muted">{key}</code>
                  <button
                    type="button"
                    onClick={() => {
                      revert(key, "en");
                      revert(key, "tn");
                    }}
                    title="Reset to the built-in text"
                    className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted hover:text-ink"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>

                {(["en", "tn"] as Locale[]).map((editLocale) => (
                  <label key={editLocale} className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-[10px] font-bold uppercase text-muted">
                      {editLocale}
                    </span>
                    <textarea
                      dir={editLocale === "tn" ? "rtl" : "ltr"}
                      rows={1}
                      value={current(key, editLocale)}
                      placeholder={defaultCopy(editLocale, key)}
                      onChange={(e) => edit(key, editLocale, e.target.value)}
                      className="w-full resize-y rounded-xl border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
                    />
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 flex items-center gap-3 bg-surface/98 pt-2">
          <button
            type="button"
            onClick={publish}
            disabled={isPending || dirtyCount === 0}
            className="flex-1 rounded-full bg-accent px-5 py-3 font-display font-bold text-bg transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {isPending
              ? "Publishing…"
              : dirtyCount > 0
                ? `Publish ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
                : "Publish"}
          </button>
          {saved && dirtyCount === 0 && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-accent">
              <Check className="h-4 w-4" />
              Published
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Changes go live for everyone as soon as you publish. Clearing a box resets that
          line to the built-in text. Only you can see this bar.
        </p>
      </div>
    </div>
  );
}
