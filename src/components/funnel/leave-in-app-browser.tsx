"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { externalBrowserUrl, inAppPlatform, type InAppPlatform } from "@/lib/in-app-browser";
import { t, type Locale } from "@/lib/i18n";

/** Remembered for the visit, so the hand-off is attempted once, not on every page. */
const TRIED_KEY = "hype_left_in_app";

/**
 * Sends a visitor arriving from Instagram on to their real browser, and tells
 * them how to do it by hand when the phone will not.
 *
 * See lib/in-app-browser.ts for why this matters and why it cannot be made
 * certain. The order here is deliberate:
 *
 *   1. On Android, try once, straight away, before the visitor has started
 *      answering questions — a hand-off halfway through would throw their
 *      answers away.
 *   2. If this page is still the one on screen — or at once on iPhone, where
 *      the automatic attempt is refused — show a card with a button that opens
 *      the same page in the browser, the manual steps under it, and an X.
 *
 * It never tries twice in a visit. A page that keeps bouncing somebody towards
 * a browser they cannot reach is worse than the in-app browser it was trying
 * to leave. And it never blocks: the questionnaire underneath works in the
 * in-app browser exactly as before.
 */
export function LeaveInAppBrowser({ locale }: { locale: Locale }) {
  const [platform, setPlatform] = useState<InAppPlatform | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const found = inAppPlatform(navigator.userAgent);
    if (!found) return;

    const out = externalBrowserUrl(navigator.userAgent, window.location.href);

    let tried = false;
    try {
      tried = sessionStorage.getItem(TRIED_KEY) === "1";
      sessionStorage.setItem(TRIED_KEY, "1");
    } catch {
      // Storage blocked: treat it as already tried rather than risk a loop.
      tried = true;
    }

    // Android only. On iPhone, Instagram blocks a page that sends itself to
    // Safari and allows it when the visitor taps — so there the button below
    // is the hand-off, and it is shown at once.
    if (found === "android" && !tried && out) window.location.href = out;

    // Android: still here after the phone has had time to switch apps.
    const delay = found === "ios" ? 300 : tried ? 400 : 1800;
    const timer = setTimeout(() => {
      setTarget(out);
      setPlatform(found);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  if (!platform) return null;

  return (
    <div className="hint-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 mx-auto flex max-w-md flex-col gap-2.5 rounded-2xl border border-white/10 bg-surface2 py-3 pe-10 ps-4 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.9)]">
      <p className="text-[13px] font-bold leading-snug text-ink">{t(locale, "iab.title")}</p>

      {/* A real link, tapped by the visitor: the one form of this both phones
          honour. One tap, and the same page opens in the browser. */}
      {target && (
        <a
          href={target}
          className="press self-start rounded-full bg-accent px-4 py-2 text-[14px] font-bold text-bg"
        >
          {t(locale, platform === "ios" ? "iab.open_safari" : "iab.open_chrome")}
        </a>
      )}

      {/* And the way that works whatever the phone does with that link. */}
      <p className="text-[12px] leading-snug text-muted">
        {t(locale, platform === "ios" ? "iab.how_ios" : "iab.how_android")}
      </p>

      <button
        type="button"
        onClick={() => setPlatform(null)}
        aria-label={t(locale, "hint.close")}
        className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}
