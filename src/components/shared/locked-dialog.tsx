"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { type LockedFeature } from "@/lib/access";
import { LOCK_REASON } from "@/components/shared/locked";

/**
 * The upsell as a dismissible dialog, for controls that sit inside a screen a
 * free account is allowed to be on.
 *
 * The diary is the case this exists for. It renders on `/diet`, which is free
 * so that somebody can read the meal plan they just generated — but "Add food"
 * writes a log, which is not. Routing that tap to /checkout would throw away
 * the screen they were reading; failing silently would look broken. So it
 * interrupts, explains, and leaves them exactly where they were if they
 * dismiss it.
 *
 * Built here rather than pulled in: the project has no dialog primitive (see
 * components/ui), and one modal does not justify a dependency.
 */
export function LockedDialog({
  locale,
  feature,
  onClose,
}: {
  locale: Locale;
  feature: LockedFeature;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus moves into the dialog so a keyboard or screen-reader user is not
    // left behind on the button that opened it.
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under the overlay on touch.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-dialog-title"
        // Clicks inside must not reach the backdrop's dismiss handler.
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-hairline bg-surface p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t(locale, "lock.not_now")}
          className="absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="flex w-max items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Lock className="h-3 w-3" />
          {t(locale, "lock.title")}
        </span>

        <h2 id="locked-dialog-title" className="text-lg font-extrabold leading-snug">
          {t(locale, LOCK_REASON[feature])}
        </h2>
        <p className="text-sm text-muted">{t(locale, "lock.free_note")}</p>

        <Link
          href={`/checkout?from=${feature}`}
          className="mt-2 rounded-full bg-accent px-5 py-3 text-center font-display font-bold text-bg transition-transform hover:-translate-y-0.5"
        >
          {t(locale, "lock.cta")}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="text-center text-xs font-bold text-muted hover:text-ink"
        >
          {t(locale, "lock.not_now")}
        </button>
      </div>
    </div>
  );
}
