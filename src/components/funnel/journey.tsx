"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * Where the reader is, and what is still ahead of them.
 *
 * The purchase runs across three routes — /checkout, /login, back to /checkout
 * — and until now each one only knew about itself. The strip at the top of
 * checkout counted its own two screens, so the account form that appears
 * between them was an unannounced extra step, and the wait for activation was
 * not in the count at all. A reader who cannot see the end of a process assumes
 * the worst about its length, which on a page that has just asked for money is
 * an expensive assumption.
 *
 * So one bar, four steps, the same on every screen of the flow.
 */

const STEPS: StringKey[] = ["jn.plan", "jn.account", "jn.pay", "jn.access"];

export function JourneyBar({
  locale,
  current,
}: {
  locale: Locale;
  /** 1 = the offer, 2 = the account, 3 = paying, 4 = activated. */
  current: 1 | 2 | 3 | 4;
}) {
  return (
    <nav
      aria-label={t(locale, "act.title")}
      className="flex flex-col gap-2"
    >
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
        {t(locale, "co.step")} {current} {t(locale, "co.of")} {STEPS.length} ·{" "}
        {t(locale, STEPS[current - 1])}
      </p>
      <ol className="flex gap-1.5">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const here = n === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                aria-hidden
                className={cn(
                  "h-1 rounded-full transition-colors",
                  done || here ? "bg-accent" : "bg-white/10",
                )}
              />
              <span
                aria-current={here ? "step" : undefined}
                className={cn(
                  "flex items-center justify-center gap-1 truncate text-[10px] font-bold",
                  here ? "text-ink" : "text-muted",
                )}
              >
                {done && <Check className="h-2.5 w-2.5 shrink-0 text-accent" />}
                {t(locale, label)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const ACTIVATION: { title: StringKey; body: StringKey }[] = [
  { title: "act.s1", body: "act.s1_body" },
  { title: "act.s2", body: "act.s2_body" },
  { title: "act.s3", body: "act.s3_body" },
  { title: "act.s4", body: "act.s4_body" },
];

/**
 * The whole path from the button to an open account, before the button.
 *
 * Payment here is a transfer made in the customer's own banking app and
 * confirmed by a person hours later. That cannot be removed — but the surprise
 * can. A reader who taps expecting a card form and meets a bank transfer has
 * been misled by omission; a reader who was told the shape of it beforehand is
 * simply following steps, and they stop being friction and start being a
 * process that visibly ends.
 *
 * Directly under the CTA rather than above it: the price and the button are one
 * decision block and nothing belongs between them, and this is what the reader
 * scrolls a thumb's width to find when they hesitate.
 */
export function ActivationSteps({ locale }: { locale: Locale }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[15px] font-extrabold leading-tight">
          {t(locale, "act.title")}
        </h2>
        <p className="text-[12px] leading-relaxed text-muted">{t(locale, "act.sub")}</p>
      </div>

      <ol className="flex flex-col gap-3">
        {ACTIVATION.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-0.5 font-display text-[11px] font-extrabold tabular-nums text-accent">
              {/* 01, 02 … — a number the eye counts down rather than a bullet. */}
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] font-bold leading-tight text-ink">
                {t(locale, step.title)}
              </span>
              <span className="text-[12.5px] leading-relaxed text-muted">
                {t(locale, step.body)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
