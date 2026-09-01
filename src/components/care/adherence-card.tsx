"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { logRenalAdherence } from "@/app/actions/clinical";

/**
 * "Did today match the paper?" — three buttons, once a day.
 *
 * Not a score and not a streak. The app did not write the plan, so it is in no
 * position to grade him against it; it records his own answer so the person
 * who DID write the plan has something to read at the next appointment.
 */

const OPTIONS: { value: "on_plan" | "partial" | "off_plan"; labelKey: StringKey }[] = [
  { value: "on_plan", labelKey: "care.adherence_on_plan" },
  { value: "partial", labelKey: "care.adherence_partial" },
  { value: "off_plan", labelKey: "care.adherence_off_plan" },
];

export function AdherenceCard({
  locale,
  current,
}: {
  locale: Locale;
  current: "on_plan" | "partial" | "off_plan" | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (value: "on_plan" | "partial" | "off_plan") => {
    setError(null);
    startTransition(async () => {
      const result = await logRenalAdherence(value);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <ClipboardCheck className="h-5 w-5 text-accent" />
        {t(locale, "care.adherence_title")}
      </h2>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={isPending}
            onClick={() => save(option.value)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors disabled:opacity-50",
              current === option.value
                ? "border-accent bg-accent/15 text-accent"
                : "border-white/15 hover:bg-white/5",
            )}
          >
            {t(locale, option.labelKey)}
          </button>
        ))}
      </div>
      {current && <p className="text-xs text-muted">{t(locale, "care.adherence_saved")}</p>}
      {error && <p className="text-sm font-bold text-red-400">{error}</p>}
    </section>
  );
}
