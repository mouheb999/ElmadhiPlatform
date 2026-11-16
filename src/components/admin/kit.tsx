import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small set of pieces every admin screen is built from, so the sections
 * read as one product: the same header, the same tiles, the same chips, the
 * same card. No state and no hooks — usable from Server and Client Components
 * alike.
 */

/** The admin card: a 22px-radius surface with a hairline edge. */
export const adminCard = "rounded-[22px] border border-hairline bg-surface";

/** Text areas across the panel. 16px+ so a phone does not zoom on focus. */
export const adminTextarea =
  "min-h-24 w-full rounded-2xl border-0 bg-surface2 px-4 py-3 text-base text-ink placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

/** Inputs that sit on a card, one step lighter than the card itself. */
export const adminInputOnCard = "bg-surface2";

/** Title block at the top of a section: small eyebrow, big title, one line of context. */
export function AdminHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

/** A section title inside a page, with an optional count or action beside it. */
export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">{children}</h2>
      {right && <div className="text-xs font-bold tabular-nums text-muted">{right}</div>}
    </div>
  );
}

/**
 * One headline number. Renders as a button when `onClick` is given (a tile
 * that filters the list below it), otherwise as a plain block.
 */
export function StatTile({
  value,
  label,
  icon: Icon,
  tone = "text-accent",
  selected,
  onClick,
  highlight,
}: {
  value: React.ReactNode;
  label: string;
  icon?: LucideIcon;
  /** Tailwind text colour for the icon. */
  tone?: string;
  selected?: boolean;
  onClick?: () => void;
  /** Draws the tile in the accent tint without it being a toggle. */
  highlight?: boolean;
}) {
  const body = (
    <>
      {Icon && <Icon className={cn("h-5 w-5", tone)} />}
      <div>
        <div className="font-num text-3xl font-extrabold leading-none tabular-nums" dir="ltr">
          {value}
        </div>
        <div className="mt-1.5 text-xs font-bold text-muted">{label}</div>
      </div>
    </>
  );
  const className = cn(
    "flex flex-col gap-3 rounded-[22px] border p-4 text-start transition-colors",
    selected || highlight ? "border-accent/40 bg-accent/10" : "border-hairline bg-surface",
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(className, "press cursor-pointer", !selected && "hover:border-white/20")}
    >
      {body}
    </button>
  );
}

/** A filter pill. Filled grey at rest, accent-tinted when on, 40px tall. */
export function FilterChip({
  selected,
  onClick,
  children,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "press flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors",
        selected ? "bg-accent text-bg" : "bg-surface2 text-muted hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums", selected ? "opacity-70" : "opacity-60")}>{count}</span>
      )}
    </button>
  );
}

/** Two or three views of the same screen, as one pill-shaped switch. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex rounded-full bg-surface p-1" role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "press flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors",
              active ? "bg-surface2 text-ink" : "text-muted",
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.count !== undefined && option.count > 0 && (
              <span
                className={cn(
                  "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-accent text-bg" : "bg-white/10",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A person's initial in a tinted disc. Falls back to a dot for a number. */
export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const first = (name ?? "").trim().charAt(0);
  const letter = /\p{L}/u.test(first) ? first : "•";
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-base font-extrabold uppercase text-accent",
        className,
      )}
    >
      {letter}
    </span>
  );
}

/** What a list shows when there is nothing in it. */
export function EmptyState({
  icon: Icon,
  title,
  sub,
  positive,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  /** An empty queue is good news; draw it that way. */
  positive?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-[22px] border px-6 py-10 text-center",
        positive ? "border-accent/30 bg-accent/10" : "border-hairline bg-surface",
      )}
    >
      <Icon className={cn("h-8 w-8", positive ? "text-accent" : "text-muted")} />
      <p className="font-extrabold">{title}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

/** A small status pill. `tone` is a set of Tailwind bg/text classes. */
export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", tone)}>
      {children}
    </span>
  );
}

/** An inline error banner. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-semibold text-danger">
      {children}
    </p>
  );
}
