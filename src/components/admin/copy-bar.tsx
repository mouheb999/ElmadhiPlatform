"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { publishCopy, type CopyEdit } from "@/app/actions/copy";
import { defaultCopy, t, type Locale, type StringKey } from "@/lib/i18n";
import {
  findEditable,
  readDraft,
  readFlag,
  replaceTextInPlace,
  writeDraft,
  writeFlag,
  type CopyDraft,
} from "@/lib/copy-edit";
import { cn } from "@/lib/utils";

type Target = { element: Element; keys: StringKey[]; key: StringKey };

/**
 * Edit mode: turn it on in Settings, walk the app, tap any text to rewrite it.
 *
 * Identification is by what the text *says*, not by a key threaded through the
 * markup — see lib/copy-edit. That is the whole reason this works without
 * touching the ~1500 places `t()` is called, and it means anything already on
 * screen is editable the moment the mode is on.
 *
 * The flag and the pending edits live in localStorage rather than React state
 * because the point is to keep editing *across* pages: every navigation in this
 * app is a fresh server render, and anything held in memory here would be gone
 * by the time the next screen painted.
 */
export function AdminCopyBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [draft, setDraft] = useState<CopyDraft>({});
  const [target, setTarget] = useState<Target | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // localStorage is not readable during render on the server, so the mode is
  // adopted after mount. Until then this renders nothing and the app behaves
  // exactly as it does for everyone else.
  useEffect(() => {
    setOn(readFlag());
    setDraft(readDraft());
  }, []);

  const dirtyCount = Object.keys(draft).length;

  const openEditor = useCallback(
    (element: Element, keys: StringKey[], key: StringKey) => {
      setTarget({ element, keys, key });
      const pending = readDraft()[`${locale}:${key}`];
      setValue(pending !== undefined ? pending : t(locale, key));
      setSaved(false);
    },
    [locale],
  );

  // Capture phase, so a tap lands on the editor instead of following the link
  // or submitting the form it happens to be sitting on.
  useEffect(() => {
    if (!on) return;

    function onClick(event: MouseEvent) {
      const start = event.target as Element | null;
      if (start?.closest?.("[data-copy-ui]")) return; // the bar itself

      const found = findEditable(locale, start);
      if (!found) return;

      event.preventDefault();
      event.stopPropagation();
      openEditor(found.element, found.keys, found.keys[0]);
    }

    document.addEventListener("click", onClick, true);
    document.body.classList.add("copy-edit-on");
    return () => {
      document.removeEventListener("click", onClick, true);
      document.body.classList.remove("copy-edit-on");
    };
  }, [on, locale, openEditor]);

  function applyEdit() {
    if (!target) return;
    const before = t(locale, target.key);
    const next = { ...draft, [`${locale}:${target.key}`]: value };
    setDraft(next);
    writeDraft(next);
    // Repaint immediately: the edit is not published yet, so nothing else will
    // put the new words on screen, and an admin has to see what they changed.
    replaceTextInPlace(target.element, before, value || defaultCopy(locale, target.key));
    setTarget(null);
  }

  function publish() {
    setError(null);
    const edits: CopyEdit[] = Object.entries(draft).map(([composite, text]) => {
      const separator = composite.indexOf(":");
      return {
        locale: composite.slice(0, separator),
        key: composite.slice(separator + 1),
        value: text,
      };
    });
    startTransition(async () => {
      const result = await publishCopy(edits);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft({});
      writeDraft({});
      setSaved(true);
      router.refresh();
    });
  }

  function exit() {
    writeFlag(false);
    writeDraft({});
    setDraft({});
    setOn(false);
    setTarget(null);
    router.refresh();
  }

  if (!on) return null;

  return (
    <div data-copy-ui>
      {/* Tap-to-edit outlines. Scoped to a body class so the app is untouched
          the instant edit mode is off. */}
      <style>{`
        body.copy-edit-on * { cursor: crosshair !important; }
        body.copy-edit-on [data-copy-ui] * { cursor: auto !important; }
      `}</style>

      {target && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-hairline bg-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-extrabold">Edit this text</p>
              <button
                type="button"
                onClick={() => setTarget(null)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* The same words can come from more than one key. Guessing would
                silently rewrite a screen the admin is not looking at. */}
            {target.keys.length > 1 && (
              <div className="flex flex-col gap-1">
                <p className="text-[11px] text-muted">
                  This text is used in {target.keys.length} places — pick which one:
                </p>
                <div className="flex flex-wrap gap-1">
                  {target.keys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => openEditor(target.element, target.keys, k)}
                      className={cn(
                        "rounded-full border px-2 py-1 text-[10px] font-bold",
                        k === target.key
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted hover:text-ink",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              autoFocus
              rows={3}
              dir={locale === "tn" ? "rtl" : "ltr"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full resize-y rounded-2xl border border-hairline bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
            />

            <p className="text-[11px] text-muted">
              Editing the {locale === "tn" ? "Tunisian Arabic" : "English"} version. Switch the
              app language in Settings to edit the other one.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyEdit}
                className="flex-1 rounded-full bg-accent px-4 py-2.5 font-display font-bold text-bg"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("");
                }}
                title="Clear to restore the built-in text on publish"
                className="rounded-full border border-hairline px-4 py-2.5 text-sm font-bold text-muted hover:text-ink"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-accent/40 bg-surface/98 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-bold text-accent">
            <Pencil className="h-4 w-4" />
            Edit mode
          </span>
          <span className="flex-1 truncate text-xs text-muted">
            {error ? (
              <span className="text-red-500">{error}</span>
            ) : saved && dirtyCount === 0 ? (
              <span className="flex items-center gap-1 text-accent">
                <Check className="h-3.5 w-3.5" />
                Published
              </span>
            ) : dirtyCount > 0 ? (
              `${dirtyCount} change${dirtyCount === 1 ? "" : "s"} waiting`
            ) : (
              "Tap any text to change it"
            )}
          </span>
          <button
            type="button"
            onClick={publish}
            disabled={isPending || dirtyCount === 0}
            className="rounded-full bg-accent px-4 py-2 font-display text-sm font-bold text-bg disabled:opacity-40"
          >
            {isPending ? "…" : "Publish"}
          </button>
          <button
            type="button"
            onClick={exit}
            className="rounded-full border border-hairline px-4 py-2 text-sm font-bold text-muted hover:text-ink"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
