"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { applyDietAdaptation } from "@/app/actions/adaptations";

export type AdaptationProposalView = {
  reasonKey: string;
  oldCalories: number;
  newCalories: number;
  deltaKcal: number;
  trendKg: number;
  newProteinG: number;
  newCarbsG: number;
  newFatG: number;
};

/** The coach's proposed calorie adjustment — explained, one tap to apply. */
export function AdaptationCard({
  locale,
  proposal,
}: {
  locale: Locale;
  proposal: AdaptationProposalView;
}) {
  const router = useRouter();
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyDietAdaptation();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setApplied(true);
      router.refresh();
    });
  }

  const sign = proposal.deltaKcal > 0 ? "+" : "";
  const trendSign = proposal.trendKg > 0 ? "+" : "";

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-accent/40 bg-accent/10 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <span className="text-sm font-bold uppercase tracking-wider text-accent">
          {t(locale, "adapt.card_title")}
        </span>
      </div>

      <p className="text-sm font-semibold leading-relaxed">
        {t(locale, proposal.reasonKey as StringKey)}
      </p>

      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-extrabold text-muted line-through">{proposal.oldCalories}</span>
        <span className="text-2xl font-extrabold">→ {proposal.newCalories} kcal</span>
        <span className="text-sm font-bold text-accent">
          ({sign}
          {proposal.deltaKcal})
        </span>
      </div>

      <p className="text-xs text-muted">
        {t(locale, "adapt.trend_label")}: {trendSign}
        {proposal.trendKg} kg · P {proposal.newProteinG}g · C {proposal.newCarbsG}g · F {proposal.newFatG}g ·{" "}
        {t(locale, "adapt.protein_note")}
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {applied ? (
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <CheckCircle2 className="h-5 w-5" />
          {t(locale, "adapt.applied")}
        </div>
      ) : (
        <Button size="sm" onClick={apply} disabled={isPending}>
          {t(locale, "adapt.accept")}
        </Button>
      )}
    </div>
  );
}
