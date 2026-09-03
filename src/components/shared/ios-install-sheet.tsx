"use client";

import { useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { rememberInstallDismissed } from "@/lib/install-prompt";

/**
 * The Add to Home Screen explainer for iOS, built around a silent screen
 * recording of the real Safari flow.
 *
 * A video rather than prose because the hard step is spatial: people do not
 * fail to *understand* "tap Share", they fail to find the button. Six seconds
 * of footage pointing at it converts far better than three numbered lines.
 *
 * The three lines stay anyway, underneath — and become the whole sheet if the
 * recording is missing or fails to decode, so this ships useful before anyone
 * records anything.
 *
 * Android never reaches here: Chrome fires `beforeinstallprompt` and gets a
 * real one-tap button instead. See lib/install-prompt.
 */
export function IosInstallSheet({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    // Focus moves into the sheet so a keyboard or screen-reader user is not
    // left behind on whatever was underneath it.
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under the overlay on touch.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Every exit is a "no" worth remembering, including Escape and the backdrop. */
  function dismiss() {
    rememberInstallDismissed();
    onClose();
  }

  const steps = [
    t(locale, "install.ios.step1"),
    t(locale, "install.ios.step2"),
    t(locale, "install.ios.step3"),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        // Clicks inside must not reach the backdrop's dismiss handler.
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-hairline bg-surface p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label={t(locale, "install.ios.not_now")}
          className="absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="flex w-max items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Share className="h-3 w-3" />
          HYPE
        </span>

        <h2 id="ios-install-title" className="text-lg font-extrabold leading-snug">
          {t(locale, "install.ios.title")}
        </h2>
        <p className="text-sm text-muted">{t(locale, "install.ios.body")}</p>

        {!videoFailed && (
          /*
           * iOS plays this inline only because all four attributes are present.
           * `playsInline` is the one that matters most: without it Safari takes
           * the video fullscreen on play and swallows the sheet whole. `muted`
           * is what buys the right to autoplay at all — a video with sound is
           * blocked until the user taps, and this one has no sound to lose.
           */
          <video
            src="/install/ios-install.mp4"
            poster="/install/ios-install.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={t(locale, "install.ios.title")}
            onError={() => setVideoFailed(true)}
            className="mt-1 w-full rounded-2xl border border-hairline bg-[#161616]"
          />
        )}

        <ol className="mt-1 flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-muted">{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 rounded-full bg-accent px-5 py-3 text-center font-display font-bold text-bg transition-transform hover:-translate-y-0.5"
        >
          {t(locale, "install.ios.got_it")}
        </button>
      </div>
    </div>
  );
}
