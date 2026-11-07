/**
 * The live session's own skeleton.
 *
 * The group-level `(app)/loading.tsx` already covers this route, so this is a
 * refinement rather than a fix — but it is the route most worth refining. The
 * generic skeleton is dashboard-shaped (a hero, a pair of tiles, a strip), and
 * this page is a single tall stack of set rows, so the swap from placeholder to
 * content visibly reflowed. It is also the slowest page in the product to
 * arrive: eight queries, including five hundred rows of history for the
 * progression suggestions.
 *
 * And it is the one screen where the wait happens standing in a gym with a
 * barbell loaded, which is the argument for it matching.
 */
export default function SessionLoading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {/* Day name + the sync pill */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface" />
      </div>

      {/* Rest timer / progress strip */}
      <div className="h-12 w-full animate-pulse rounded-2xl bg-surface" />

      {/* Exercise cards: a thumbnail, a title, and a few set rows each. */}
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-3xl border border-hairline bg-surface/40 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-surface" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
            </div>
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-11 w-full animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ))}
    </div>
  );
}
