import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export type TrainingTileProgram = {
  name: string;
  splitType: string;
  daysPerWeek: number;
};

const SPLIT_LABEL: Record<string, string> = {
  full_body: "Full Body",
  upper_lower: "Upper/Lower",
  ppl: "Push/Pull/Legs",
  arnold: "Arnold Split",
};

/** Deliberately a different visual treatment from NutritionTile (glass,
 * dusk-tinted) so the two tiles read as distinct data types, not a repeated
 * card shape (personalization-engine.md §13's "controlled variation"). */
export function TrainingTile({ locale, program }: { locale: Locale; program: TrainingTileProgram | null }) {
  if (!program) {
    return (
      <div className="flex h-full flex-col justify-between rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted">{t(locale, "dashboard.training_label")}</span>
          <Dumbbell className="h-4 w-4 text-muted" />
        </div>
        <div>
          <p className="text-sm text-muted">{t(locale, "dashboard.not_setup")}</p>
          <Link href="/workout" className="mt-2 inline-block text-sm font-bold text-accent">
            {t(locale, "dashboard.cta_start")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/workout/program"
      className="flex h-full flex-col rounded-2xl border p-4 backdrop-blur transition-colors hover:bg-white/5"
      style={{
        borderColor: "rgba(139,147,255,0.28)",
        background: "linear-gradient(160deg, rgba(139,147,255,0.12), rgba(32,32,32,0.5))",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted">{t(locale, "dashboard.training_label")}</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ backgroundColor: "rgba(139,147,255,0.18)" }}>
          <Dumbbell className="h-3.5 w-3.5" style={{ color: "#8B93FF" }} />
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-base font-extrabold leading-snug">{program.name}</p>
      <p className="mt-1 text-xs text-muted">
        {SPLIT_LABEL[program.splitType] ?? program.splitType} · {program.daysPerWeek} {t(locale, "dashboard.days_per_week_suffix")}
      </p>
    </Link>
  );
}
