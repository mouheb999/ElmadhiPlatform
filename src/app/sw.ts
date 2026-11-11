/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Injected at build time by `createSerwistRoute` — the precache list. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The minimal service worker.
 *
 * Deliberately *not* `defaultCache` from @serwist/turbopack, which is what the
 * quick start uses. That preset caches pages and RSC payloads, and this app's
 * pages are somebody's dashboard, their meal log and their weigh-ins — every
 * one of them `force-dynamic` and scoped by RLS to one account. Caching them in
 * a store keyed only by URL would mean a stale weight on the dashboard at best,
 * and on a shared phone, one account's numbers rendered for the next person to
 * sign in at worst. The real offline support is a separate piece of work with
 * its own per-user storage; this file exists to make the app installable and to
 * replace Chrome's dinosaur with our own screen.
 *
 * So: documents always go to the network, and the only things cached are
 * content-addressed build output and images.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    /**
     * Navigations: straight to the network, every time.
     *
     * NetworkOnly rather than "no rule at all" is load-bearing. A request the
     * service worker does not handle falls through to the browser, and the
     * browser's failure is its own offline error page — the thing we are here
     * to replace. Handling it with a strategy that never caches gives the
     * fallback below something to hang off while keeping the response fresh.
     */
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkOnly(),
  },
  {
    /**
     * Next's build output under /_next/static is content-hashed, so a URL's
     * bytes never change — the one safe thing to cache hard. Precaching
     * already covers the shell; this catches the lazily-loaded route chunks a
     * user reaches by navigating.
     */
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 })],
    }),
  },
  {
    /**
     * Exercise illustrations and food photography. These are the heaviest
     * thing the app loads and they are the same bytes for everyone — not user
     * data — so they are safe to keep and genuinely worth keeping: a gym with
     * one bar of signal is the normal case.
     */
    matcher: ({ request }) => request.destination === "image",
    handler: new CacheFirst({
      cacheName: "images",
      plugins: [
        // Only store a response that actually succeeded. Without this, an
        // opaque error from a flaky connection gets cached as though it were
        // the picture, and the placeholder sticks until the cache expires.
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      ],
    }),
  },
];

// Referenced so the import is not dead code while we are not using the preset:
// keeping the symbol in view makes the deliberate choice above visible to
// anyone who greps for `defaultCache` after reading Serwist's quick start.
void defaultCache;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  /**
   * Update strategy: take over immediately.
   *
   * `skipWaiting` retires the old worker as soon as a new one installs instead
   * of waiting for every tab to close, and `clientsClaim` puts the new one in
   * charge of pages that are already open. Together they mean a deploy reaches
   * people on their next page load rather than whenever they next quit the app
   * — and in a TWA, "quit the app" can be weeks.
   *
   * The usual argument against this pair is that swapping the worker under a
   * running page can leave it asking for chunks the new precache no longer
   * lists. It is not a real risk here: the only things cached are
   * content-hashed assets, a miss simply goes to the network, and the hosting
   * keeps the previous build's files. Set against that, the failure mode of
   * the cautious option — a user stuck on a months-old build with no way to
   * know — is both worse and silent.
   */
  skipWaiting: true,
  clientsClaim: true,
  // Let the browser start the network request in parallel with booting this
  // worker, so adding a service worker does not make the first navigation of
  // a cold start slower than it was without one.
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        // Only for page navigations. An image or a script that fails offline
        // should fail, not quietly resolve to a page of HTML.
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Reminders.
 *
 * The server sends a small JSON payload — a title, a body and the path to open
 * — and this shows it. A push that cannot be read still shows something: the
 * browser requires a visible notification for every push, and silently
 * swallowing one gets the permission revoked.
 *
 * `tag` means a newer reminder of the same kind replaces the one already on
 * the lock screen instead of stacking under it.
 */
self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/dashboard";
  event.waitUntil(
    self.registration.showNotification(payload.title || "HYPE FITNESS", {
      body: payload.body || "",
      icon: "/icon",
      badge: "/icons/icon-monochrome-512.png",
      tag: payload.tag || "hype",
      data: { url },
    }),
  );
});

/**
 * Tapping a reminder opens the app at the place it was about — and reuses a
 * window that is already open rather than starting a second copy of the app.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
