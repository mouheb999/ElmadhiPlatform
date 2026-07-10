/**
 * Instant fallback shown while a signed-in section streams in. Every /(app) route
 * is force-dynamic and queries Supabase on navigation, so without this the tap
 * blocks on the server round-trip. The app shell (header + bottom nav) persists
 * across navigation — only this content area swaps — so switching tabs now feels
 * immediate instead of frozen.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-surface" />
          <div className="h-6 w-32 animate-pulse rounded-lg bg-surface" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-full bg-surface" />
      </div>

      <div className="h-40 w-full animate-pulse rounded-3xl bg-surface" />
      <div className="h-28 w-full animate-pulse rounded-3xl bg-surface" />

      <div className="grid grid-cols-2 gap-3">
        <div className="h-32 animate-pulse rounded-3xl bg-surface" />
        <div className="h-32 animate-pulse rounded-3xl bg-surface" />
      </div>

      <div className="h-24 w-full animate-pulse rounded-3xl bg-surface" />
    </div>
  );
}
