/**
 * Instant skeleton shown while an admin page segment streams in. Because the
 * admin layout (header + nav) persists across navigation, switching tabs swaps
 * only this content area — so tab changes feel immediate instead of blocking.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-surface" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-2xl bg-surface" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-2xl border border-hairline p-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-surface" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-40 animate-pulse rounded bg-surface" />
                <div className="h-3 w-28 animate-pulse rounded bg-surface" />
              </div>
            </div>
            <div className="hidden gap-2 sm:flex">
              <div className="h-9 w-16 animate-pulse rounded-full bg-surface" />
              <div className="h-9 w-16 animate-pulse rounded-full bg-surface" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
