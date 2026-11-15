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
 *   1. Try once, straight away, before the visitor has started answering
 *      questions — a hand-off halfway through would throw their answers away.
 *   2. A moment later, if this page is still the one on screen, the hand-off
 *      did not happen. Show one line saying how to open the browser from
 *      Instagram's own menu, with an X.
 *
 * It never tries twice in a visit. A page that keeps bouncing somebody towards
 * a browser they cannot reach is worse than the in-app browser it was trying
 * to leave. And it never blocks: the questionnaire underneath works in the
 * in-app browser exactly as before.
 */
export function LeaveInAppBrowser({ locale }: { locale: Locale }) {
  const [platform, setPlatform] = useState<InAppPlatform | null>(null);

  useEffect(() => {
    const found = inAppPlatform(navigator.userAgent);
    if (!found) return;

    let tried = false;
    try {
      tried = sessionStorage.getItem(TRIED_KEY) === "1";
      sessionStorage.setItem(TRIED_KEY, "1");
    } catch {
      // Storage blocked: treat it as already tried rather than risk a loop.
      tried = true;
    }

    if (!tried) {
      const target = externalBrowserUrl(navigator.userAgent, window.location.href);
      if (target) window.location.href = target;
    }

    // Still here after the phone has had time to switch apps: say how.
    const timer = setTimeout(() => setPlatform(found), tried ? 400 : 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!platform) return null;

  return (
    <div className="hint-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-surface2 py-3 pe-10 ps-4 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.9)]">
      <p className="text-[13px] leading-snug text-muted">
        <span className="font-bold text-ink">{t(locale, "iab.title")}</span>{" "}
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
