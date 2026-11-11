/**
 * Instant fallback shown while a signed-in section streams in. Every /(app)
 * route is force-dynamic and queries Supabase on navigation, so without this
 * the tap blocks on the server round-trip. The app shell (header + tab bar)
 * persists across navigation — only this content area swaps — so switching
 * tabs feels immediate instead of frozen.
 *
 * Shaped like the redesigned screens — a large title, then a card, a section
 * heading, a taller card — so the swap from placeholder to content lands where
 * the eye already is instead of reflowing.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-40 animate-pulse rounded bg-surface" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-surface" />
        </div>
        <div className="h-40 w-full animate-pulse rounded-card bg-surface" />
      </div>

      <div>
        <div className="mb-3 h-7 w-44 animate-pulse rounded-lg bg-surface" />
        <div className="h-72 w-full animate-pulse rounded-card bg-surface" />
      </div>

      <div>
        <div className="mb-3 h-7 w-24 animate-pulse rounded-lg bg-surface" />
        <div className="h-52 w-full animate-pulse rounded-card bg-surface" />
      </div>
    </div>
  );
}
