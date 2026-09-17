"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { DecimalInput } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";
import { dir, t, type Locale } from "@/lib/i18n";

/**
 * The parts every screen of /start is built from.
 *
 * The whole funnel is one question per screen with a thumb-sized answer, which
 * is not decoration: the reader is on a phone, they came from an ad, and the
 * cost of a screen they have to think about how to use is measured in people
 * who close the tab. Nothing here takes more than one tap except the four
 * numbers, and those open the numeric keypad by themselves.
 */

/** The bar across the top. Counts questions only — interstitials are not work. */
export function ProgressBar({
  current,
  total,
  locale,
  onBack,
}: {
  /** 1-based index of the question being answered; 0 before the first. */
  current: number;
  total: number;
  locale: Locale;
  onBack?: () => void;
}) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  const Back = dir(locale) === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        aria-label={t(locale, "fn.back")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-ink disabled:opacity-0"
      >
        <Back className="h-5 w-5" />
      </button>

      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
        <bdi>
          {current}/{total}
        </bdi>
      </span>
    </div>
  );
}

/** Title, optional hint, then whatever the screen is. */
export function ScreenBody({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-balance font-display text-[26px] font-extrabold leading-tight tracking-tight">
          {title}
        </h1>
        {hint && <p className="mx-auto max-w-[34ch] text-balance text-sm leading-relaxed text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export type Choice = { value: string; label: string; sub?: string };

/**
 * One-tap answers.
 *
 * The tap both selects and advances, with a beat in between so the reader sees
 * their own choice light up before the screen changes. A separate Continue
 * button under a single-choice question doubles the taps in the funnel for no
 * information: eleven questions becomes twenty-two decisions to sit through.
 */
export function ChoiceList({
  choices,
  value,
  onPick,
}: {
  choices: Choice[];
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {choices.map((choice) => {
        const active = value === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onPick(choice.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-5 py-4 text-start transition-all active:scale-[0.99]",
              active
                ? "border-accent bg-accent/10 ring-1 ring-accent"
                : "border-hairline bg-surface hover:bg-white/5",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-[15px] font-extrabold leading-snug">{choice.label}</span>
              {choice.sub && <span className="text-[13px] leading-snug text-muted">{choice.sub}</span>}
            </span>
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                active ? "border-accent bg-accent" : "border-white/20",
              )}
            >
              {active && <Check className="h-3.5 w-3.5 text-bg" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One number, one unit, one keypad.
 *
 * Autofocused, because the keyboard appearing by itself is the difference
 * between a question and a form field. The draft lives here rather than in the
 * answers object for the same reason `NumberField` keeps one: a half-typed
 * "70." is not a number yet, and echoing the parsed value back would delete
 * the decimal point the moment it was pressed.
 */
export function NumberEntry({
  value,
  unit,
  decimal = false,
  invalid,
  onChange,
  onSubmit,
}: {
  value: number | undefined;
  unit: string;
  decimal?: boolean;
  invalid?: string | null;
  onChange: (value: number | undefined) => void;
  onSubmit: () => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const input = useRef<HTMLInputElement>(null);

  // Focus on mount. The screen wrapper is keyed per step, so this runs once
  // per question rather than on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  function update(next: string) {
    const cleaned = decimal ? next : next.replace(/\./g, "");
    setDraft(cleaned);
    onChange(parseDecimal(cleaned) ?? undefined);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-center gap-2" dir="ltr">
        <DecimalInput
          ref={input}
          value={draft}
          onValueChange={update}
          inputMode={decimal ? "decimal" : "numeric"}
          enterKeyHint="next"
          placeholder="—"
          className="h-auto w-[4.5ch] border-0 bg-transparent px-0 text-center font-display text-[56px] font-extrabold leading-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="font-display text-xl font-bold text-muted">{unit}</span>
      </div>
      <span className="mx-auto h-px w-32 bg-accent/50" aria-hidden />
      {invalid && (
        <p className="text-center text-sm text-red-500" role="alert">
          {invalid}
        </p>
      )}
      {/* Submits the form, which is what makes the keypad's "next" key work. */}
      <button type="submit" className="sr-only">
        {unit}
      </button>
    </form>
  );
}

/** The sticky bottom action. Only screens that need a tap to advance show one. */
export function BottomAction({
  label,
  disabled,
  onClick,
  locale,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  locale: Locale;
  /** Anything that belongs under the button — a reassurance line, usually. */
  children?: React.ReactNode;
}) {
  const Forward = dir(locale) === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-5 pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex h-14 w-full items-center justify-center gap-2 rounded-full font-display text-base font-bold transition-all active:scale-[0.98]",
          disabled
            ? "bg-white/10 text-muted"
            : "bg-accent text-bg shadow-[0_12px_32px_-8px_rgba(192,218,27,0.5)]",
        )}
      >
        {label}
        <Forward className="h-5 w-5" />
      </button>
      {children}
    </div>
  );
}
