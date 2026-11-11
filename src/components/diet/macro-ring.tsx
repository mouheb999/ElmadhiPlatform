"use client";

import { t, type Locale } from "@/lib/i18n";

// The same three colours the macros wear on Today and in the diary.
const MACRO_COLORS = {
  protein: "var(--protein)",
  carbs: "var(--fuel)",
  fat: "var(--sleep)",
} as const;

function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">{label}</span>
          <span className="flex items-baseline gap-0.5" style={{ color }}>
            <span className="font-num text-[17px] font-bold">{Math.round(value)}</span>
            <span className="font-num text-[13px] font-bold opacity-60">/{target}</span>
            <span className="text-[11px] font-bold uppercase">g</span>
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function MacroRing({
  locale,
  calories,
  caloriesTarget,
  proteinG,
  proteinTargetG,
  carbsG,
  carbsTargetG,
  fatG,
  fatTargetG,
  dailyTargetLabel,
}: {
  locale: Locale;
  calories: number;
  caloriesTarget: number;
  proteinG: number;
  proteinTargetG: number;
  carbsG: number;
  carbsTargetG: number;
  fatG: number;
  fatTargetG: number;
  dailyTargetLabel: string;
}) {
  const pct = caloriesTarget > 0 ? Math.min(calories / caloriesTarget, 1) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="card-surface flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--train)" strokeOpacity={0.2} strokeWidth="14" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--train)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-num text-[34px] font-bold leading-none text-train">{Math.round(calories)}</span>
          <span className="mt-1 text-[13px] font-bold uppercase text-train">{t(locale, "home.kcal")}</span>
          <span className="mt-1 text-[13px] text-muted">{dailyTargetLabel}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        {/* These read "Protein / Carbs / Fats" in English on every screen,
            including the Arabic one, which is where they are mostly read. The
            catalogue has had the words all along. */}
        <Bar label={t(locale, "diary.macro_protein")} value={proteinG} target={proteinTargetG} color={MACRO_COLORS.protein} />
        <Bar label={t(locale, "diary.macro_carbs")} value={carbsG} target={carbsTargetG} color={MACRO_COLORS.carbs} />
        <Bar label={t(locale, "diary.macro_fat")} value={fatG} target={fatTargetG} color={MACRO_COLORS.fat} />
      </div>
    </div>
  );
}
