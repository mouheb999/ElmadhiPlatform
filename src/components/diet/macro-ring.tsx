"use client";

const MACRO_COLORS = {
  protein: "#5DD62C",
  carbs: "#F5A623",
  fat: "#B76CFF",
} as const;

/** Monochrome fill for the diary's progress look (fills as meals get logged). */
const NEUTRAL_FILL = "rgba(255,255,255,0.85)";

function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{label}</span>
          <span className="text-muted">
            {Math.round(value)}g / {target}g
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function MacroRing({
  calories,
  caloriesTarget,
  proteinG,
  proteinTargetG,
  carbsG,
  carbsTargetG,
  fatG,
  fatTargetG,
  dailyTargetLabel,
  variant = "colored",
}: {
  calories: number;
  caloriesTarget: number;
  proteinG: number;
  proteinTargetG: number;
  carbsG: number;
  carbsTargetG: number;
  fatG: number;
  fatTargetG: number;
  dailyTargetLabel: string;
  /** "neutral" renders the ring and bars monochrome — pure progress, no hue. */
  variant?: "colored" | "neutral";
}) {
  const neutral = variant === "neutral";
  const pct = caloriesTarget > 0 ? Math.min(calories / caloriesTarget, 1) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={neutral ? NEUTRAL_FILL : "#5DD62C"}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold">{Math.round(calories)}</span>
          <span className="text-xs text-muted">kcal</span>
          <span className="mt-1 text-xs text-muted">{dailyTargetLabel}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <Bar label="Protein" value={proteinG} target={proteinTargetG} color={neutral ? NEUTRAL_FILL : MACRO_COLORS.protein} />
        <Bar label="Carbs" value={carbsG} target={carbsTargetG} color={neutral ? NEUTRAL_FILL : MACRO_COLORS.carbs} />
        <Bar label="Fats" value={fatG} target={fatTargetG} color={neutral ? NEUTRAL_FILL : MACRO_COLORS.fat} />
      </div>
    </div>
  );
}
