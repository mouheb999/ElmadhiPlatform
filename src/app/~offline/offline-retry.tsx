"use client";

import { useEffect, useState } from "react";

const RETRY_INTERVAL_MS = 5000;

/**
 * Makes "retrying" true rather than decorative.
 *
 * Two triggers, because neither alone is enough. The `online` event fires the
 * instant the device reattaches to a network, which covers walking back into
 * signal — but `navigator.onLine` only knows about the interface, so it stays
 * quiet on the gym wifi that is connected and routes nowhere. The poll covers
 * that: a real request to a real URL is the only thing that actually answers
 * "can we reach the server".
 *
 * The probe asks for the manifest rather than a page: it is small, static, and
 * on the same origin, so a success means the server is genuinely answering and
 * a reload will land on something.
 */
export function OfflineRetry() {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (cancelled) return;
      try {
        // `cache: "no-store"` so a cached 200 cannot look like a live server.
        await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" });
        if (!cancelled) window.location.reload();
      } catch {
        // Still down. The interval will come round again.
      }
    }

    const timer = setInterval(probe, RETRY_INTERVAL_MS);
    window.addEventListener("online", probe);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", probe);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        setChecking(true);
        window.location.reload();
      }}
      className="rounded-full bg-accent px-6 py-3 font-display font-bold text-bg transition-transform active:scale-95 disabled:opacity-60"
      disabled={checking}
    >
      {/* Both languages, for the same reason the page is bilingual. */}
      <span dir="rtl">عاود</span>
      <span aria-hidden> · </span>
      <span dir="ltr">Retry</span>
    </button>
  );
}
