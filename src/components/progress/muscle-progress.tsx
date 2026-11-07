import { t, type Locale } from "@/lib/i18n";

export type MuscleRow = {
  muscle: string;
  label: string;
  /** Sets logged in the last 4 weeks. */
  recentSets: number;
  /** Sets logged in the 4 weeks before that. */
  prevSets: number;
};

/**
 * Where the training went, counted in sets.
 *
 * Sets rather than kilos of "volume": "Chest — 24 sets" means something to
 * anyone who has trained, while "Chest — 9,840 kg" means nothing to most
 * people, and a set of push-ups or planks counted as zero kilos made those
 * muscles look untrained. One bar per muscle for the last 4 weeks, with the
 * change against the 4 weeks before written beside it as "+6" or "−3".
 * A drop is grey, not red: a lighter month is a choice, not an error.
 */
export function MuscleProgress({ locale, rows }: { locale: Locale; rows: MuscleRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[15px] text-muted">{t(locale, "progress.empty_strength")}</p>;
  }
  const max = Math.max(...rows.map((r) => r.recentSets), 1);

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const delta = r.recentSets - r.prevSets;
        return (
          <li key={r.muscle}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{r.label}</span>
              <span className="flex items-baseline gap-2">
                <span
                  className={
                    r.prevSets === 0
                      ? "text-[13px] font-semibold text-protein"
                      : delta > 0
                        ? "text-[13px] font-semibold text-train"
                        : "text-[13px] font-semibold text-muted"
                  }
                >
                  {r.prevSets === 0 ? (
                    t(locale, "progress.new_label")
                  ) : delta === 0 ? (
                    "="
                  ) : (
                    <bdi dir="ltr">{`${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}</bdi>
                  )}
                </span>
                <span className="flex items-baseline gap-1 text-ink">
                  <span className="font-num text-[17px] font-bold">{r.recentSets}</span>
                  <span className="text-[11px] font-bold uppercase text-muted">{t(locale, "progress.sets_unit")}</span>
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-train"
                style={{ width: `${Math.max((r.recentSets / max) * 100, r.recentSets > 0 ? 3 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
