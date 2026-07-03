"use client";

import { useRouter } from "next/navigation";
import { QuestionWizard, type WizardStep } from "@/components/shared/question-wizard";
import { OptionCardGroup } from "@/components/shared/option-card";
import { Input } from "@/components/ui/input";
import { FoodSearch, type FoodResult } from "@/components/diet/food-search";
import { submitDietQuestions, type DietAnswers } from "@/app/actions/diet";
import { t, type Locale } from "@/lib/i18n";

type WizardAnswers = Omit<DietAnswers, "dislikedFoodIds"> & { dislikedFoods: FoodResult[] };

export function DietQuestionsClient({ locale }: { locale: Locale }) {
  const router = useRouter();

  const steps: WizardStep<WizardAnswers>[] = [
    {
      key: "gender",
      title: t(locale, "diet.q_gender"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "male", label: t(locale, "diet.gender_male") },
            { value: "female", label: t(locale, "diet.gender_female") },
          ]}
          value={answers.gender}
          onChange={(v) => setAnswer("gender", v as WizardAnswers["gender"])}
        />
      ),
    },
    {
      key: "age",
      title: t(locale, "diet.q_birthdate"),
      isValid: (a) => !!a.age && a.age > 0,
      render: ({ answers, setAnswer }) => (
        <Input
          type="number"
          inputMode="numeric"
          value={answers.age ?? ""}
          onChange={(e) => setAnswer("age", Number(e.target.value))}
          className="text-center text-2xl"
        />
      ),
    },
    {
      key: "heightCm",
      title: t(locale, "diet.q_height"),
      isValid: (a) => !!a.heightCm && a.heightCm > 0,
      render: ({ answers, setAnswer }) => (
        <Input
          type="number"
          inputMode="numeric"
          value={answers.heightCm ?? ""}
          onChange={(e) => setAnswer("heightCm", Number(e.target.value))}
          className="text-center text-2xl"
        />
      ),
    },
    {
      key: "weightKg",
      title: t(locale, "diet.q_weight"),
      isValid: (a) => !!a.weightKg && a.weightKg > 0,
      render: ({ answers, setAnswer }) => (
        <Input
          type="number"
          inputMode="decimal"
          value={answers.weightKg ?? ""}
          onChange={(e) => setAnswer("weightKg", Number(e.target.value))}
          className="text-center text-2xl"
        />
      ),
    },
    {
      key: "goal",
      title: t(locale, "diet.q_goal"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "lose_fat", label: t(locale, "diet.goal_lose_fat") },
            { value: "maintain", label: t(locale, "diet.goal_maintain") },
            { value: "build_muscle", label: t(locale, "diet.goal_build_muscle") },
            { value: "recomp", label: t(locale, "diet.goal_recomp") },
          ]}
          value={answers.goal}
          onChange={(v) => setAnswer("goal", v as WizardAnswers["goal"])}
        />
      ),
    },
    {
      key: "activityLevel",
      title: t(locale, "diet.q_activity"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "sedentary", label: t(locale, "diet.activity_sedentary") },
            { value: "light", label: t(locale, "diet.activity_light") },
            { value: "moderate", label: t(locale, "diet.activity_moderate") },
            { value: "active", label: t(locale, "diet.activity_active") },
            { value: "very_active", label: t(locale, "diet.activity_very_active") },
          ]}
          value={answers.activityLevel}
          onChange={(v) => setAnswer("activityLevel", v as WizardAnswers["activityLevel"])}
        />
      ),
    },
    {
      key: "mealsPerDay",
      title: t(locale, "diet.q_meals"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
          value={answers.mealsPerDay ? String(answers.mealsPerDay) : undefined}
          onChange={(v) => setAnswer("mealsPerDay", Number(v))}
        />
      ),
    },
    {
      key: "budgetLevel",
      title: t(locale, "diet.q_budget"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "low", label: t(locale, "diet.budget_low") },
            { value: "medium", label: t(locale, "diet.budget_medium") },
            { value: "high", label: t(locale, "diet.budget_high") },
          ]}
          value={answers.budgetLevel}
          onChange={(v) => setAnswer("budgetLevel", v as WizardAnswers["budgetLevel"])}
        />
      ),
    },
    {
      key: "allergies",
      title: t(locale, "diet.q_allergies"),
      optional: true,
      isValid: () => true,
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          multi
          options={["lactose", "gluten", "nuts", "shellfish", "eggs"].map((a) => ({ value: a, label: a }))}
          value={answers.allergies ?? []}
          onChange={(v) => setAnswer("allergies", v as string[])}
        />
      ),
    },
    {
      key: "dietaryRestriction",
      title: t(locale, "diet.q_restriction"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "none", label: t(locale, "diet.restriction_none") },
            { value: "vegetarian", label: t(locale, "diet.restriction_vegetarian") },
            { value: "pescatarian", label: t(locale, "diet.restriction_pescatarian") },
            { value: "halal", label: t(locale, "diet.restriction_halal") },
          ]}
          value={answers.dietaryRestriction}
          onChange={(v) => setAnswer("dietaryRestriction", v as string)}
        />
      ),
    },
    {
      key: "dislikedFoods",
      title: t(locale, "diet.q_disliked"),
      optional: true,
      isValid: () => true,
      render: ({ answers, setAnswer }) => (
        <FoodSearch
          locale={locale}
          selected={answers.dislikedFoods ?? []}
          onChange={(foods) => setAnswer("dislikedFoods", foods)}
          placeholder={locale === "tn" ? "لوّج على ماكلة…" : "Search foods…"}
        />
      ),
    },
  ];

  async function handleComplete(answers: WizardAnswers) {
    const result = await submitDietQuestions({
      ...answers,
      allergies: answers.allergies ?? [],
      dislikedFoodIds: (answers.dislikedFoods ?? []).map((f) => f.id),
    });
    if (!result.ok) throw new Error(result.error);
    router.push("/diet/rationale");
  }

  return (
    <QuestionWizard
      steps={steps}
      onComplete={handleComplete}
      locale={locale}
      initialAnswers={{ mealsPerDay: 3, dietaryRestriction: "none", allergies: [], dislikedFoods: [] }}
    />
  );
}
