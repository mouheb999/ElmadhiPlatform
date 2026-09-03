"use client";

import { useEffect, useState } from "react";
import { type Locale } from "@/lib/i18n";
import {
  useInstallPrompt,
  wasInstallDismissed,
} from "@/lib/install-prompt";
import { IosInstallSheet } from "@/components/shared/ios-install-sheet";

/** Long enough that the sheet reads as an offer, not as part of page load. */
const DELAY_MS = 4000;

/**
 * Decides whether the iOS install explainer is worth interrupting for.
 *
 * Mounted in the app shell rather than on one screen because
 * `beforeinstallprompt` fires during initial load — a listener that mounts
 * later has already missed it. Android takes that path and never renders
 * anything here; iOS is the only branch with a sheet, because it is the only
 * platform with no install API to call.
 *
 * Deliberately quiet: once dismissed it stays dismissed, and it waits a few
 * seconds so it lands after the screen the user actually came for.
 */
export function InstallGate({ locale }: { locale: Locale }) {
  const state = useInstallPrompt();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state.kind !== "ios-manual" || wasInstallDismissed()) return;
    const timer = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.kind]);

  if (!show || state.kind !== "ios-manual") return null;
  return <IosInstallSheet locale={locale} onClose={() => setShow(false)} />;
}
