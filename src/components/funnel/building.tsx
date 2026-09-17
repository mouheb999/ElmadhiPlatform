"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * The pause before the reveal.
 *
 * There is no server call behind this — the plan is arithmetic and it is done
 * in under a millisecond. The wait is for the reader, not the machine: four
 * lines naming the four things their answers were used for, so the numbers on
 * the next screen arrive as the output of a process they watched rather than
 * as a page that was always going to say that.
 *
 * It is also the last honest place to put a loading state. Everything it lists
 * really does happen — from these answers, in this order — the moment they
 * subscribe and the questionnaire runs for real.
 *
 * Kept short. Three seconds is a beat; six is a progress bar somebody is
 * waiting on.
 */

const LINES: StringKey[] = ["fn.build_1", "fn.build_2", "fn.build_3", "fn.build_4"];

/** Per line. Four of these plus the closing beat is a shade over three seconds. */
const TICK_MS = 620;
const CLOSING_MS = 500;

export function BuildingScreen({ locale, onDone }: { locale: Locale; onDone: () => void }) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setDone(i + 1), TICK_MS * (i + 1)));
    });
    timers.push(setTimeout(onDone, TICK_MS * LINES.length + CLOSING_MS));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/15">
          <Loader2 className="h-6 w-6 animate-spin text-accent motion-reduce:animate-none" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {t(locale, "fn.build_title")}
        </h1>
        <p className="text-sm text-muted">{t(locale, "fn.build_sub")}</p>
      </div>

      <ul className="flex w-full max-w-xs flex-col gap-3">
        {LINES.map((line, i) => {
          const complete = i < done;
          const active = i === done;
          return (
            <li
              key={line}
              className={cn(
                "flex items-center gap-3 transition-opacity duration-300 motion-reduce:transition-none",
                complete || active ? "opacity-100" : "opacity-35",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  complete ? "border-accent bg-accent" : "border-white/20",
                )}
              >
                {complete && <Check className="h-3.5 w-3.5 text-bg" strokeWidth={3} />}
              </span>
              <span className={cn("text-sm", complete ? "font-bold text-ink" : "text-muted")}>
                {t(locale, line)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
