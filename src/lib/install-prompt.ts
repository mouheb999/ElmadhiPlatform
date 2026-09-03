"use client";

/**
 * Home-screen install state.
 *
 * Capability-first: Chrome announces installability by firing
 * `beforeinstallprompt`, so on Android we never guess from the user agent. iOS
 * is the exception that forces sniffing — Safari fires no such event and Add to
 * Home Screen has no API, so a pointed-at-the-Share-button explainer is the
 * only install path Apple leaves open.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type Choice = { outcome: "accepted" | "dismissed" };
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<Choice> };

export type InstallState =
  | { kind: "installed" }
  | { kind: "ready"; install: () => Promise<boolean> }
  | { kind: "ios-manual" }
  | { kind: "unsupported" };

/** Remembers a dismissal so the sheet interrupts once, not every session. */
const DISMISSED_KEY = "elmadhi_install_dismissed";

/** Already launched from the home screen? Then there is nothing to offer. */
function isInstalled(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari predates the standard and only sets this non-standard flag.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * iPhone or iPad.
 *
 * iPadOS 13+ reports itself as "Macintosh" so sites serve it the desktop
 * layout, which means a plain /iPad/ test matches zero iPads. A Mac reporting
 * touch points is an iPad.
 */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Instagram/Facebook/TikTok webviews cannot install anything, and the Share
 * sheet they show is their own rather than Safari's — the steps we would give
 * simply do not exist there. Better to stay silent than to teach a dead end.
 */
function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line|TikTok/.test(navigator.userAgent);
}

/**
 * Installed-ness is external, observable state rather than something this hook
 * owns, so it is read through a subscription instead of copied into an effect:
 * the display-mode query flips the moment the app is installed, including while
 * this sheet is open. The server snapshot is `false` — there is no window to
 * ask during SSR, and offering an install to someone who already installed is
 * the cheap mistake here.
 */
function subscribeInstalled(onChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

/**
 * Never fires. Pairs with a `true`/`false` snapshot to answer "are we past
 * hydration yet?" without a setState-in-effect.
 */
function subscribeNever(): () => void {
  return () => {};
}

export function useInstallPrompt(): InstallState {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  /*
   * Node 21+ defines a global `navigator`, so the platform sniffs below do not
   * crash during SSR — they quietly answer for the server instead of the phone
   * (`maxTouchPoints` is undefined there, so every iPad reads as desktop). That
   * makes the server and client disagree, so the sniff is deferred until after
   * hydration and both passes start from the same answer.
   */
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const installed = useSyncExternalStore(
    subscribeInstalled,
    isInstalled,
    () => false,
  );

  useEffect(() => {
    if (installed) return;

    const onPrompt = (e: Event) => {
      // Suppress Chrome's own banner; the app offers its own button instead.
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    // Once installed there is nothing left to prompt with.
    const onInstalled = () => setEvent(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  const install = useCallback(async () => {
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The event is single-use. Chrome fires a fresh one later if dismissed.
    setEvent(null);
    return outcome === "accepted";
  }, [event]);

  if (!hydrated) return { kind: "unsupported" };
  if (installed) return { kind: "installed" };
  if (event) return { kind: "ready", install };
  if (isIOS() && !isInAppBrowser()) return { kind: "ios-manual" };
  return { kind: "unsupported" };
}

export function wasInstallDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private mode / blocked storage: treat as not dismissed but never throw.
    return false;
  }
}

export function rememberInstallDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Nothing to do — worst case the sheet asks again next session.
  }
}
