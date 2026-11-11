"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDown, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { HINT_COOKIE_MAX_AGE, HINT_INSTALL_COOKIE, HINT_PROGRESS_COOKIE } from "@/lib/hints";
import { t, type Locale } from "@/lib/i18n";

/** Chrome's install event. Not in lib.dom, so described here. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "other";

type Env = {
  platform: Platform;
  /** Already launched from the home screen: nothing to offer. */
  installed: boolean;
};

/** The screens a pointer may appear on. Never over a workout or the camera. */
const CALM_PATHS = ["/dashboard", "/workout", "/diet", "/progress"];

function remember(cookie: string) {
  document.cookie = `${cookie}=1; path=/; max-age=${HINT_COOKIE_MAX_AGE}; samesite=lax`;
}

function readEnv(): Env {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { platform: ios ? "ios" : /Android/.test(ua) ? "android" : "other", installed };
}

/**
 * Two pointers, one at a time, each put away with an X and never shown again.
 *
 * **The first** says the plan they were shown before signing up now lives
 * under Progress, with an arrow standing on that tab. The timeline is the
 * reason most people created an account, and it sits one tab away from where
 * they land; without this the likeliest outcome is that they never find it.
 *
 * **The second** offers to put the app on the home screen. A fitness app is
 * opened several times a day, and one that has to be found in a browser's
 * tabs each time is one that stops being opened. On Android it is a single tap
 * — Chrome hands us the install prompt and the button fires it. On an iPhone
 * there is no such API, so the card shows the two taps in Safari's own icons.
 *
 * Never both at once: the second waits until the first is gone. Neither
 * appears during a workout or over the camera, and both sit above the tab bar
 * rather than over the content, so nothing has to be dismissed to use the app.
 *
 * Inside the store apps the second is never shown — the app is already
 * installed — and neither is it once the site is running from a home screen.
 */
export function AppHints({
  locale,
  showProgress,
  showInstall,
}: {
  locale: Locale;
  /** A timeline exists and this pointer has not been dismissed. */
  showProgress: boolean;
  /** Not the store app, and this card has not been dismissed. */
  showInstall: boolean;
}) {
  const pathname = usePathname();
  const [progressOpen, setProgressOpen] = useState(showProgress);
  const [installOpen, setInstallOpen] = useState(showInstall);
  const [env, setEnv] = useState<Env | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  // A beat after the screen settles, so a pointer arrives as its own event
  // rather than as part of the page loading. The environment is read in the
  // same callback: it needs `window`, and nothing shows before it is known.
  useEffect(() => {
    const timer = setTimeout(() => setEnv(readEnv()), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Chrome fires this when the site can be installed; holding the event is
  // what lets our own button open the system prompt later.
  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      remember(HINT_INSTALL_COOKIE);
      setInstallOpen(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function closeProgress() {
    remember(HINT_PROGRESS_COOKIE);
    setProgressOpen(false);
  }

  function closeInstall() {
    remember(HINT_INSTALL_COOKIE);
    setInstallOpen(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Accepted or declined, they have answered the question.
    closeInstall();
  }

  if (!env) return null;
  if (!CALM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  // The session logger lives under /workout and must stay clear.
  if (pathname.startsWith("/workout/session")) return null;

  const onProgress = pathname === "/progress" || pathname.startsWith("/progress/");
  // Standing on the tab it points at, the pointer has nothing left to say. It
  // is not marked dismissed here: the tap that brought them does that.
  const progressVisible = progressOpen && !onProgress;

  // What can honestly be offered on this device. A desktop browser with no
  // install event gets nothing rather than instructions that may not apply.
  const canInstall =
    !env.installed && (env.platform === "ios" || env.platform === "android" || prompt !== null);
  const installVisible = installOpen && !progressOpen && canInstall;

  if (!progressVisible && !installVisible) return null;

  return (
    <div
      className="app-chrome pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 mx-auto max-w-md"
      style={{ viewTransitionName: "app-hints" }}
    >
      {progressVisible && (
        <div className="hint-in relative flex justify-end pb-10">
          <div className="pointer-events-auto relative w-[min(18rem,100%)] rounded-[20px] bg-accent py-3 pe-10 ps-4 text-bg shadow-[0_14px_36px_-10px_rgba(168,255,0,0.55)]">
            <Link href="/progress" onClick={closeProgress} className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold leading-snug">
                {t(locale, "hint.progress_title")}
              </span>
              <span className="text-[13px] font-semibold leading-snug opacity-75">
                {t(locale, "hint.progress_body")}
              </span>
            </Link>
            <button
              type="button"
              onClick={closeProgress}
              aria-label={t(locale, "hint.close")}
              className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-bg/15"
            >
              <X className="h-4 w-4" strokeWidth={2.6} />
            </button>
          </div>
          {/* The arrow, standing over the Progress tab. Five equal tabs, so the
              last one's centre is a tenth of the bar in from its end — and
              "end" is the left edge in Arabic, which is where that tab is. */}
          <span
            aria-hidden
            className="absolute bottom-0 end-[10%] -me-4 grid h-8 w-8 animate-bounce place-items-center text-accent drop-shadow-[0_0_10px_rgba(168,255,0,0.7)]"
          >
            <ArrowDown className="h-8 w-8" strokeWidth={3.2} />
          </span>
        </div>
      )}

      {installVisible && (
        <div className="hint-in pointer-events-auto relative flex items-center gap-3 rounded-[20px] border border-white/10 bg-surface2 py-3 pe-10 ps-3 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-icon" alt="" className="h-11 w-11 shrink-0 rounded-[12px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold leading-snug text-ink">
              {t(locale, "hint.install_title")}
            </span>
            {prompt ? (
              <span className="text-[13px] leading-snug text-muted">
                {t(locale, "hint.install_one_tap")}
              </span>
            ) : env.platform === "ios" ? (
              // Safari's own two icons, in the order they are tapped.
              <span className="flex flex-wrap items-center gap-1 text-[13px] leading-snug text-muted">
                {t(locale, "hint.install_tap")}
                <Share className="h-4 w-4 text-ink" strokeWidth={2.2} />
                {t(locale, "hint.install_then")}
                <SquarePlus className="h-4 w-4 text-ink" strokeWidth={2.2} />
                <span className="font-semibold text-ink">{t(locale, "hint.install_a2hs")}</span>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-1 text-[13px] leading-snug text-muted">
                {t(locale, "hint.install_tap")}
                <MoreVertical className="h-4 w-4 text-ink" strokeWidth={2.2} />
                {t(locale, "hint.install_then")}
                <span className="font-semibold text-ink">{t(locale, "hint.install_a2hs")}</span>
              </span>
            )}
          </div>
          {prompt && (
            <button
              type="button"
              onClick={install}
              className="press shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-bold text-bg"
            >
              {t(locale, "hint.install_cta")}
            </button>
          )}
          <button
            type="button"
            onClick={closeInstall}
            aria-label={t(locale, "hint.close")}
            className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}
