"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { flagSymptom, SYMPTOMS } from "@/app/actions/clinical";

/**
 * The symptom flags — half of what decides whether the program moves.
 *
 * Every symptom in the closed vocabulary is a chip, because a text box would
 * produce "dizzy", "dizzyness" and "الدوخة" for one thing the progression rule
 * is looking for by exact name. Severity is asked second and only once a
 * symptom is picked: two taps for the common case, three for a bad day.
 */

const SEVERITIES: { value: "mild" | "moderate" | "severe"; labelKey: StringKey }[] = [
  { value: "mild", labelKey: "care.sev_mild" },
  { value: "moderate", labelKey: "care.sev_moderate" },
  { value: "severe", labelKey: "care.sev_severe" },
];

export function SymptomCard({
  locale,
  sessionId = null,
}: {
  locale: Locale;
  sessionId?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = (severity: "mild" | "moderate" | "severe") => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await flagSymptom({ symptom: selected, severity, sessionId });
      if (!result.ok) setError(result.error);
      else {
        setSelected(null);
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Flag className="h-5 w-5 text-accent" />
        {t(locale, "care.symptoms_title")}
      </h2>
      <p className="text-xs text-muted">{t(locale, "care.symptoms_hint")}</p>

      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.map((symptom) => (
          <button
            key={symptom}
            type="button"
            onClick={() => setSelected(selected === symptom ? null : symptom)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
              selected === symptom
                ? "border-accent bg-accent/15 text-accent"
                : "border-white/15 hover:bg-white/5",
            )}
          >
            {t(locale, `care.sym_${symptom}` as StringKey)}
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex gap-2">
          {SEVERITIES.map((severity) => (
            <button
              key={severity.value}
              type="button"
              disabled={isPending}
              onClick={() => save(severity.value)}
              className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-bold hover:bg-white/5 disabled:opacity-50"
            >
              {t(locale, severity.labelKey)}
            </button>
          ))}
        </div>
      )}

      {saved && !selected && <p className="text-xs text-accent">{t(locale, "care.adherence_saved")}</p>}
      {error && <p className="text-sm font-bold text-red-400">{error}</p>}
    </section>
  );
}
