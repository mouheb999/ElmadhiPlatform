"use client";

import { cn } from "@/lib/utils";

export type Option<T extends string> = { value: T; label: string; sub?: string };

/** Big tappable option cards — one question per screen (architecture.md §4). */
export function OptionCardGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: Option<T>[];
  value: T | T[] | undefined;
  onChange: (value: T | T[]) => void;
  multi?: boolean;
}) {
  const selected = (v: T) => (multi ? ((value as T[]) ?? []).includes(v) : value === v);

  function choose(v: T) {
    if (!multi) {
      onChange(v);
      return;
    }
    const current = (value as T[]) ?? [];
    onChange(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const active = selected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-2xl border px-5 py-4 text-start transition-all",
              active
                ? "border-accent bg-accent/10 text-ink"
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
