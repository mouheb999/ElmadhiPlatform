"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDietIntensity } from "@/app/actions/diet";
import type { DietIntensity, Goal } from "@/lib/algorithms/diet-strategy";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/shared/warning-banner";
import type { Locale } from "@/lib/i18n";

const FAST_INTENSITY: Partial<Record<Goal, DietIntensity>> = {
  lose_fat: "aggressive",
  build_muscle: "dirty",
};

/** Rule D1 — the faster/looser strategy is opt-in only, shown behind a warning. */
export function IntensityToggle({
  dietProfileId,
  goal,
  currentIntensity,
  locale,
  warning,
}: {
  dietProfileId: string;
  goal: Goal;
  currentIntensity: string;
  locale: Locale;
  warning: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const fast = FAST_INTENSITY[goal];
  if (!fast) return null;
  const isFast = currentIntensity === fast;

  function toggle() {
    const next: DietIntensity = isFast ? "normal" : fast!;
    startTransition(async () => {
      await updateDietIntensity(dietProfileId, next);
      router.refresh();
      setConfirming(false);
    });
  }

  if (isFast) {
    return (
      <Button type="button" variant="secondary" onClick={toggle} disabled={isPending}>
        {locale === "tn" ? "رجع للإيقاع العادي" : "Switch back to the normal pace"}
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3">
        <WarningBanner message={warning} dismissible={false} />
        <Button type="button" onClick={toggle} disabled={isPending}>
          {locale === "tn" ? "أيه، فهمت، كمّل" : "Yes, I understand — apply it"}
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
      {locale === "tn" ? "تحب أسرع؟ →" : "Want it faster? →"}
    </Button>
  );
}
