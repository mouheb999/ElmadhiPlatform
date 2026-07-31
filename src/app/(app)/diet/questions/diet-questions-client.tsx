"use client";

import { useRouter } from "next/navigation";
import { QuestionWizard, type WizardStep } from "@/components/shared/question-wizard";
import { OptionCardGroup } from "@/components/shared/option-card";
import { NumberField } from "@/components/shared/number-field";
import { submitDietQuestions, type DietAnswers } from "@/app/actions/diet";
import { t, type Locale, type StringKey } from "@/lib/i18n";

type WizardAnswers = DietAnswers;

export function DietQuestionsClient({ locale }: { locale: Locale }) {
  const router = useRouter();
  const tr = (k: StringKey) => t(locale, k);

  const numberStep = (
    key: "age" | "heightCm" | "weightKg" | "targetWeightKg",
    titleKey: StringKey,
    mode: "numeric" | "decimal" = "numeric",
  ): WizardStep<WizardAnswers> => ({
    key,
    title: tr(titleKey),
    isValid: (a) => !!a[key] && (a[key] as number) > 0,
    render: ({ answers, setAnswer }) => (
      <NumberField
        decimal={mode === "decimal"}
        value={answers[key] as number | undefined}
        onValueChange={(v) => setAnswer(key, v as never)}
      />
    ),
  });

  const choice = <K extends keyof WizardAnswers>(
    key: K,
    titleKey: StringKey,
    options: { value: string; label: string }[],
    opts?: { multi?: boolean; optional?: boolean; visibleIf?: (a: Partial<WizardAnswers>) => boolean },
  ): WizardStep<WizardAnswers> => ({
    key: key as keyof WizardAnswers & string,
    title: tr(titleKey),
    optional: opts?.optional,
    visibleIf: opts?.visibleIf,
    isValid: opts?.optional ? () => true : undefined,
    render: ({ answers, setAnswer }) => (
      <OptionCardGroup
        multi={opts?.multi}
        options={options}
        value={
          opts?.multi
            ? ((answers[key] as string[]) ?? [])
            : answers[key] != null
              ? String(answers[key])
              : undefined
        }
        onChange={(v) => setAnswer(key, v as never)}
      />
    ),
  });

  const opt = (values: [string, StringKey][]) => values.map(([value, k]) => ({ value, label: tr(k) }));

  const steps: WizardStep<WizardAnswers>[] = [
    choice("goal", "diet.q_goal", opt([
      ["lose_fat", "diet.goal_lose_fat"],
      ["build_muscle", "diet.goal_build_muscle"],
      ["maintain", "diet.goal_maintain"],
      ["recomp", "diet.goal_recomp"],
    ])),
    choice("gender", "diet.q_gender", opt([
      ["male", "diet.gender_male"],
      ["female", "diet.gender_female"],
    ])),
    numberStep("age", "diet.q_birthdate"),
    numberStep("heightCm", "diet.q_height"),
    numberStep("weightKg", "diet.q_weight", "decimal"),
    numberStep("targetWeightKg", "diet.q_target_weight", "decimal"),
    choice("bodyFatLevel", "diet.q_bodyfat", opt([
      ["very_lean", "diet.bodyfat_very_lean"],
      ["normal", "diet.bodyfat_normal"],
      ["a_little_fat", "diet.bodyfat_a_little_fat"],
      ["high", "diet.bodyfat_high"],
      ["unknown", "diet.bodyfat_unknown"],
    ])),
    choice("dailySteps", "diet.q_steps", opt([
      ["under_4k", "diet.steps_under_4k"],
      ["4k_7k", "diet.steps_4k_7k"],
      ["7k_10k", "diet.steps_7k_10k"],
      ["over_10k", "diet.steps_over_10k"],
      ["unknown", "diet.steps_unknown"],
    ])),
    choice("activityLevel", "diet.q_activity", opt([
      ["sedentary", "diet.activity_sedentary"],
      ["light", "diet.activity_light"],
      ["moderate", "diet.activity_moderate"],
      ["active", "diet.activity_active"],
      ["very_active", "diet.activity_very_active"],
    ])),
    choice("trainingDays", "diet.q_training_days", opt([
      ["0", "diet.td_0"],
      ["1_2", "diet.td_1_2"],
      ["3_4", "diet.td_3_4"],
      ["5_6", "diet.td_5_6"],
      ["7", "diet.td_7"],
    ])),
    choice("mealsPerDay", "diet.q_meals", [3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))),
    choice("trainingTime", "diet.q_training_time", opt([
      ["morning", "diet.tt_morning"],
      ["afternoon", "diet.tt_afternoon"],
      ["evening", "diet.tt_evening"],
      ["night", "diet.tt_night"],
      ["changes", "diet.tt_changes"],
    ]), { visibleIf: (a) => a.trainingDays !== "0" }),
    choice("budgetLevel", "diet.q_budget", opt([
      ["low", "diet.budget_low"],
      ["medium", "diet.budget_medium"],
      ["high", "diet.budget_high"],
      ["no_pref", "diet.budget_no_pref"],
    ])),
    choice("foodRestrictions", "diet.q_restrictions", opt([
      ["none", "diet.restr_none"],
      ["no_red_meat", "diet.restr_no_red_meat"],
      ["no_fish", "diet.restr_no_fish"],
      ["no_dairy", "diet.restr_no_dairy"],
      ["no_eggs", "diet.restr_no_eggs"],
      ["vegetarian", "diet.restr_vegetarian"],
    ]), { multi: true }),
    choice("avoidFoods", "diet.q_avoid", opt([
      ["chicken", "diet.avoid_chicken"],
      ["eggs", "diet.avoid_eggs"],
      ["tuna", "diet.avoid_tuna"],
      ["fish", "diet.avoid_fish"],
      ["dairy", "diet.avoid_dairy"],
      ["rice", "diet.avoid_rice"],
      ["pasta", "diet.avoid_pasta"],
      ["bread", "diet.avoid_bread"],
      ["oats", "diet.avoid_oats"],
      ["legumes", "diet.avoid_legumes"],
      ["vegetables", "diet.avoid_vegetables"],
    ]), { multi: true, optional: true }),
    choice("cookingPref", "diet.q_cooking", opt([
      ["fast", "diet.cook_fast"],
      ["normal", "diet.cook_normal"],
      ["mealprep", "diet.cook_mealprep"],
      ["no_pref", "diet.cook_no_pref"],
    ])),
    choice("digestion", "diet.q_digestion", opt([
      ["none", "diet.dig_none"],
      ["bloating", "diet.dig_bloating"],
      ["lactose", "diet.dig_lactose"],
      ["high_fiber", "diet.dig_high_fiber"],
      ["heavy_preworkout", "diet.dig_heavy_pre"],
    ]), { multi: true, optional: true }),
    choice("waterIntake", "diet.q_water", opt([
      ["lt1", "diet.water_lt1"],
      ["1_2", "diet.water_1_2"],
      ["2_3", "diet.water_2_3"],
      ["gt3", "diet.water_gt3"],
      ["unknown", "diet.water_unknown"],
    ]), { optional: true }),
    choice("supplements", "diet.q_supplements", opt([
      ["none", "diet.supp_none"],
      ["whey", "diet.supp_whey"],
      ["creatine", "diet.supp_creatine"],
      ["multivitamin", "diet.supp_multivitamin"],
      ["omega3", "diet.supp_omega3"],
    ]), { multi: true, optional: true }),
    choice("trackingExperience", "diet.q_tracking", opt([
      ["never", "diet.track_never"],
      ["sometimes", "diet.track_sometimes"],
      ["expert", "diet.track_expert"],
    ]), { optional: true }),
  ];

  async function handleComplete(raw: WizardAnswers) {
    // "No preference" budget lets any ingredient through.
    const budgetLevel = (raw.budgetLevel as string) === "no_pref" ? "high" : raw.budgetLevel;
    const result = await submitDietQuestions({
      ...raw,
      mealsPerDay: Number(raw.mealsPerDay),
      budgetLevel: budgetLevel as DietAnswers["budgetLevel"],
      foodRestrictions: raw.foodRestrictions ?? [],
      avoidFoods: raw.avoidFoods ?? [],
      digestion: raw.digestion ?? [],
      supplements: raw.supplements ?? [],
    });
    if (!result.ok) throw new Error(result.error);
    router.push("/diet/rationale");
  }

  return (
    <QuestionWizard
      steps={steps}
      onComplete={handleComplete}
      locale={locale}
      initialAnswers={{
        mealsPerDay: 3,
        foodRestrictions: [],
        avoidFoods: [],
        digestion: [],
        supplements: [],
        bodyFatLevel: "unknown",
        dailySteps: "unknown",
        trainingDays: "3_4",
        trainingTime: "evening",
        cookingPref: "normal",
        budgetLevel: "medium",
        waterIntake: "unknown",
        trackingExperience: "never",
      }}
    />
  );
}
