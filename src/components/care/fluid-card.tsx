"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassWater, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { logFluid } from "@/app/actions/clinical";

/**
 * Fluid, against the dietitian's allowance.
 *
 * The bar goes red at the allowance and stays red — it does not cap or clamp,
 * because a day where he went over is exactly the day the number has to be
 * legible. If no allowance is on file the bar is not drawn at all, since a
 * progress bar with an invented denominator is a lie with a gradient on it.
 */

/** The glasses people actually pour, so most days are two taps. */
const QUICK_ML = [150, 200, 330];

export function FluidCard({
  locale,
  totalMl,
  allowanceMl,
}: {
  locale: Locale;
  totalMl: number;
  allowanceMl: number | null;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const add = (ml: number) => {
    setError(null);
    startTransition(async () => {
      const result = await logFluid(ml);
      if (!result.ok) setError(result.error);
      else {
        setCustom("");
        router.refresh();
      }
    });
  };

  const pct = allowanceMl ? Math.min(100, Math.round((totalMl / allowanceMl) * 100)) : null;
  const over = allowanceMl !== null && totalMl > allowanceMl;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <GlassWater className="h-5 w-5 text-accent" />
        {t(locale, "care.fluid_title")}
      </h2>

      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-3xl font-extrabold", over && "text-red-400")}>
          {totalMl}
        </span>
        <span className="text-sm text-muted">
          ml
          {allowanceMl !== null && ` / ${allowanceMl} ml`}
        </span>
      </div>

      {pct !== null ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all", over ? "bg-red-400" : "bg-accent")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-xs text-muted">{t(locale, "care.fluid_no_allowance")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            disabled={isPending}
            onClick={() => add(ml)}
            className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/5 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {ml}
          </button>
        ))}
        <Input
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="ml"
          aria-label={t(locale, "care.fluid_add")}
          className="max-w-24"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending || !custom}
          onClick={() => {
            const ml = parseInt(custom, 10);
            if (Number.isInteger(ml)) add(ml);
          }}
        >
          {t(locale, "care.fluid_add")}
        </Button>
      </div>

      {error && <p className="text-sm font-bold text-red-400">{error}</p>}
    </section>
  );
}
