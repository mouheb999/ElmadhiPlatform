import type { Bilingual } from "./diet-strategy";

export type Warning = {
  severity: "warning";
  type: string;
  message: Bilingual;
};

export type MealPlanTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MacroTargetLike = {
  calories: number;
  proteinG: number;
};

/** Warnings, never blocks — architecture.md §6. Editors stay fully editable. */
export function validateMealPlan(totals: MealPlanTotals, target: MacroTargetLike): Warning[] {
  const warnings: Warning[] = [];

  if (totals.proteinG < target.proteinG * 0.8) {
    warnings.push({
      severity: "warning",
      type: "low_protein",
      message: {
        en: `Protein is ${totals.proteinG}g — your target is ${target.proteinG}g. Too little protein slows down muscle recovery.`,
        ar: `البروتين ${totals.proteinG}غ — الهدف متاعك ${target.proteinG}غ. بروتين قليل يبطّي استرجاع العضل.`,
      },
    });
  }

  if (totals.calories > target.calories * 1.15) {
    const over = Math.round(totals.calories - target.calories);
    warnings.push({
      severity: "warning",
      type: "over_calories",
      message: {
        en: `You're ${over} kcal over your daily target.`,
        ar: `أنت زايد ${over} سعرة على هدفك اليومي.`,
      },
    });
  }

  if (totals.calories < target.calories * 0.85) {
    const under = Math.round(target.calories - totals.calories);
    warnings.push({
      severity: "warning",
      type: "under_calories",
      message: {
        en: `You're ${under} kcal under your daily target — that's too big a gap to sustain.`,
        ar: `أنت ناقص ${under} سعرة عن هدفك اليومي — فرق كبير باش تكمّل فيه.`,
      },
    });
  }

  return warnings;
}

const REQUIRED_MUSCLE_COVERAGE = ["chest", "back", "quads", "hamstrings", "shoulders"];

const MUSCLE_LABEL: Record<string, Bilingual> = {
  chest: { en: "chest", ar: "الصدر" },
  back: { en: "back", ar: "الظهر" },
  quads: { en: "quads", ar: "عضلات الفخذ الأمامية" },
  hamstrings: { en: "hamstrings", ar: "عضلات الفخذ الخلفية" },
  shoulders: { en: "shoulders", ar: "الأكتاف" },
};

/** Counts exercises per primary muscle across a full program week. */
export function countMuscleGroups(exercisePrimaryMuscles: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const muscle of exercisePrimaryMuscles) {
    counts[muscle] = (counts[muscle] ?? 0) + 1;
  }
  return counts;
}

export function validateProgram(exercisePrimaryMuscles: string[]): Warning[] {
  const coverage = countMuscleGroups(exercisePrimaryMuscles);
  const warnings: Warning[] = [];

  for (const muscle of REQUIRED_MUSCLE_COVERAGE) {
    if (!coverage[muscle]) {
      const label = MUSCLE_LABEL[muscle];
      warnings.push({
        severity: "warning",
        type: `no_${muscle}`,
        message: {
          en: `No ${label.en} exercises this week.`,
          ar: `ما فماش تمارين ${label.ar} هالأسبوع.`,
        },
      });
    }
  }

  return warnings;
}
