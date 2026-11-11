import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { OfflineRetry } from "./offline-retry";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * What the service worker serves when a navigation cannot reach the server.
 *
 * Both languages, always, and that is not laziness. Every other screen picks
 * one from the locale cookie — but this page is precached at install time and
 * then served, unchanged, to whoever is holding the phone months later. Reading
 * the cookie here would bake one visitor's language into a page shown to
 * everyone, so it shows both and nobody is stranded in a language they do not
 * read.
 *
 * Deliberately free of anything that could itself fail: no Supabase, no
 * session, no images. A fallback that needs the network is not a fallback —
 * and the first version of this page proved the point by using <Logo />, which
 * is a next/image and therefore a request to the image optimizer at
 * /_next/image?url=…. That URL is not precached and cannot sensibly be, since
 * it varies by width and device pixel ratio, so the brand mark rendered as a
 * broken-image icon in exactly the situation the page exists for.
 *
 * The wordmark is type instead. next/font self-hosts the faces under
 * /_next/static, which the service worker does precache, so this costs nothing
 * at the moment it is needed.
 *
 * Reached at /~offline. The tilde keeps it out of the way of any real route and
 * signals that it is machinery rather than a page anybody navigates to.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-center">
      <p
        dir="ltr"
        className="font-display text-xl font-extrabold tracking-[0.35em] text-accent"
      >
        HYPE
      </p>

      <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-400/15 text-amber-300">
        <WifiOff className="h-7 w-7" aria-hidden />
      </span>

      <div className="flex flex-col gap-2" dir="rtl">
        <h1 className="text-2xl font-extrabold">ما فماش اتصال</h1>
        <p className="text-muted">قاعدين نعاودو نحاولو...</p>
      </div>

      <div className="flex flex-col gap-2" dir="ltr">
        <h2 className="text-2xl font-extrabold">No connection</h2>
        <p className="text-muted">Retrying…</p>
      </div>

      <OfflineRetry />

      <p className="max-w-xs text-xs leading-relaxed text-muted">
        {/* The one reassurance worth giving here, and it is true today: the
            live session's write queue holds logged sets in local storage and
            sends them when the connection returns. */}
        <span dir="rtl" className="block">
          تسجيلاتك محفوظة وتتسنكرن كي ترجع الشبكة.
        </span>
        <span dir="ltr" className="mt-1 block">
          Anything you logged is saved and will sync when you&rsquo;re back.
        </span>
      </p>
    </main>
  );
}
