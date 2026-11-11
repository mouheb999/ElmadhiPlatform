"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { type Locale, t } from "@/lib/i18n";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * `navigator.onLine` is a weak signal — it reports whether the device has a
 * network interface, not whether our server is reachable, so it says `true` on
 * hotel wifi that goes nowhere. It is still worth reading: the false negative
 * costs nothing (no banner, and the outbox retries anyway) while the true
 * positive is the common gym case of simply having no signal.
 */
function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * The server has no idea, and guessing "offline" would flash a banner at every
 * visitor for one frame before hydration corrected it. Assume online.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * One banner, app-wide, for "you have no connection".
 *
 * Built on `useSyncExternalStore` rather than an effect that calls setState,
 * which is what this would naturally be written as. Two reasons: that is the
 * hook React provides for exactly this shape of problem (state that lives
 * outside React and changes by event), and it gives a server snapshot, so the
 * first paint matches the server's and nothing flickers. The effect version
 * also trips `react-hooks/set-state-in-effect`.
 *
 * Deliberately narrow in what it claims. It does NOT promise the app works
 * offline — it does not yet, and the service-worker work that would make it
 * true is parked. What it promises is the one thing that is already true today:
 * the live session's write queue (`lib/session-outbox`) holds logged sets in
 * localStorage and flushes them when the connection returns. So a lifter who
 * loses signal mid-set is told the right thing rather than left guessing.
 *
 * The session screen keeps its own sync pill as well, and that is not
 * duplication: this says "the network is gone", the pill says "your sets are
 * saved / saving / queued", which is the question somebody mid-workout actually
 * has.
 */
export function OfflineBanner({ locale }: { locale: Locale }) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex select-none items-center justify-center gap-2 bg-amber-400/15 px-4 py-2 text-center text-xs font-bold text-amber-300"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t(locale, "offline.banner")}
    </div>
  );
}
