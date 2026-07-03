"use client";

import { useRouter } from "next/navigation";
import { QuestionWizard, type WizardStep } from "@/components/shared/question-wizard";
import { OptionCardGroup } from "@/components/shared/option-card";
import { submitWorkoutQuestions, type WorkoutAnswers } from "@/app/actions/training";
import { t, type Locale } from "@/lib/i18n";

export function WorkoutQuestionsClient({ locale }: { locale: Locale }) {
  const router = useRouter();

  const steps: WizardStep<WorkoutAnswers>[] = [
    {
      key: "goal",
      title: t(locale, "workout.q_goal"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "lose_fat", label: t(locale, "workout.goal_lose_fat") },
            { value: "build_muscle", label: t(locale, "workout.goal_build_muscle") },
            { value: "get_stronger", label: t(locale, "workout.goal_get_stronger") },
            { value: "general_fitness", label: t(locale, "workout.goal_general_fitness") },
          ]}
          value={answers.goal}
          onChange={(v) => setAnswer("goal", v as WorkoutAnswers["goal"])}
        />
      ),
    },
    {
      key: "daysPerWeek",
      title: t(locale, "workout.q_days"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
          value={answers.daysPerWeek ? String(answers.daysPerWeek) : undefined}
          onChange={(v) => setAnswer("daysPerWeek", Number(v))}
        />
      ),
    },
    {
      key: "sessionMinutes",
      title: t(locale, "workout.q_session_minutes"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[30, 45, 60, 75, 90].map((n) => ({ value: String(n), label: `${n} min` }))}
          value={answers.sessionMinutes ? String(answers.sessionMinutes) : undefined}
          onChange={(v) => setAnswer("sessionMinutes", Number(v))}
        />
      ),
    },
    {
      key: "equipment",
      title: t(locale, "workout.q_equipment"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "full_gym", label: t(locale, "workout.equipment_full_gym") },
            { value: "home_basic", label: t(locale, "workout.equipment_home_basic") },
            { value: "home_advanced", label: t(locale, "workout.equipment_home_advanced") },
            { value: "bodyweight", label: t(locale, "workout.equipment_bodyweight") },
          ]}
          value={answers.equipment}
          onChange={(v) => setAnswer("equipment", v as WorkoutAnswers["equipment"])}
        />
      ),
    },
    {
      key: "experience",
      title: t(locale, "workout.q_experience"),
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          options={[
            { value: "beginner", label: t(locale, "workout.experience_beginner") },
            { value: "intermediate", label: t(locale, "workout.experience_intermediate") },
            { value: "advanced", label: t(locale, "workout.experience_advanced") },
          ]}
          value={answers.experience}
          onChange={(v) => setAnswer("experience", v as WorkoutAnswers["experience"])}
        />
      ),
    },
    {
      key: "injuries",
      title: t(locale, "workout.q_injuries"),
      optional: true,
      isValid: () => true,
      render: ({ answers, setAnswer }) => (
        <OptionCardGroup
          multi
          options={["shoulder", "knee", "lower_back", "wrist", "elbow"].map((i) => ({ value: i, label: i }))}
          value={answers.injuries ?? []}
          onChange={(v) => setAnswer("injuries", v as string[])}
        />
      ),
    },
  ];

  async function handleComplete(answers: WorkoutAnswers) {
    const result = await submitWorkoutQuestions({ ...answers, injuries: answers.injuries ?? [] });
    if (!result.ok) throw new Error(result.error);
    router.push("/workout/rationale");
  }

  return (
    <QuestionWizard
      steps={steps}
      onComplete={handleComplete}
      locale={locale}
      initialAnswers={{ sessionMinutes: 60, injuries: [] }}
    />
  );
}
