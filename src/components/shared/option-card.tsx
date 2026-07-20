"use client";

import { cn } from "@/lib/utils";

export type Option<T extends string> = { value: T; label: string; sub?: string };

/** Big tappable option cards — one question per screen (architecture.md §4). */
export function OptionCardGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
  maxSelections,
  exclusiveOptions,
}: {
  options: Option<T>[];
  value: T | T[] | undefined;
  onChange: (value: T | T[]) => void;
  multi?: boolean;
  /** Backs `questionnaire_questions.max_selections`. */
  maxSelections?: number;
  /**
   * Options that clear every other choice when picked — "None"-style answers.
   * Selecting "None" alongside real injuries is contradictory, so it is made
   * mutually exclusive rather than merely odd.
   */
  exclusiveOptions?: T[];
}) {
  const selected = (v: T) => (multi ? ((value as T[]) ?? []).includes(v) : value === v);
  const atLimit = multi && maxSelections !== undefined && ((value as T[]) ?? []).length >= maxSelections;

  function choose(v: T) {
    if (!multi) {
      onChange(v);
      return;
    }
    const current = (value as T[]) ?? [];
    if (current.includes(v)) {
      onChange(current.filter((x) => x !== v));
      return;
    }
    if (exclusiveOptions?.includes(v)) {
      onChange([v]);
      return;
    }
    const withoutExclusive = current.filter((x) => !exclusiveOptions?.includes(x));
    if (maxSelections !== undefined && withoutExclusive.length >= maxSelections) return;
    onChange([...withoutExclusive, v]);
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const active = selected(opt.value);
        // At the cap, unpicked options go inert rather than disappearing, so
        // the list does not reflow under the user's thumb mid-tap.
        const blocked = !active && atLimit && !exclusiveOptions?.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            aria-pressed={active}
            aria-disabled={blocked}
            className={cn(
              "rounded-2xl border px-5 py-4 text-start transition-all",
              active
                ? "border-accent bg-accent/10 text-ink"
                : blocked
                  ? "border-hairline bg-surface text-muted opacity-40"
                  : "border-hairline bg-surface text-ink hover:bg-white/5",
            )}
          >
            <div className="font-bold">{opt.label}</div>
            {opt.sub && <div className="text-sm text-muted">{opt.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}
