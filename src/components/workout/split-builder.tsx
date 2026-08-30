"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExercisePicker, type PickableExercise } from "@/components/workout/exercise-picker";
import { createCustomProgram } from "@/app/actions/custom-training";
import {
  MAX_EXERCISES_PER_DAY as MAX_PER_DAY,
  MAX_PROGRAM_DAYS as MAX_DAYS,
  MIN_PROGRAM_DAYS as MIN_DAYS,
} from "@/lib/program-limits";
import { illustrationFor } from "@/lib/exercise-illustrations";
import { cn } from "@/lib/utils";
import { dir, pick, t, type Locale, type StringKey } from "@/lib/i18n";

export type BuilderExercise = PickableExercise & {
  thumbnailUrl: string | null;
};

export type SplitShape = {
  id: string;
  titleEn: string;
  gender: string;
  daysPerWeek: number;
  dayNames: { en: string; ar: string | null }[];
};

type DraftExercise = {
  exerciseId: string;
  sets: number;
  repRange: string;
  restSeconds: number;
};

type DraftDay = {
  name: string;
  exercises: DraftExercise[];
};


/**
 * The three questions the builder opens with, already localised.
 *
 * Supplied by the page from `questionnaire_questions` rather than hard-coded
 * here: the *values* are the English strings the CHECK constraints are written
 * against, and the *labels* are whatever that table says in the user's
 * language. Duplicating the Arabic in this file would be a second place for it
 * to drift from the questionnaire that asks the very same things.
 */
export type BuilderQuestions = {
  gender: AskedQuestion;
  goal: AskedQuestion;
  experience: AskedQuestion;
};

export type AskedQuestion = {
  title: string;
  options: { value: string; label: string }[];
};

/** What a freshly added exercise starts at, before the user touches it. */
const DEFAULT_SCHEME = { sets: 3, repRange: "8-12", restSeconds: 90 } as const;

/**
 * Build a split by hand, in three passes: who it's for, what the week looks
 * like, and what goes in each day.
 *
 * All of it is local state until the final Save. There is no row-at-a-time
 * autosave here on purpose — a user assembling a program wanders, deletes a
 * day, changes their mind about Wednesday, and every one of those intermediate
 * states would be a program the rest of the app would happily show them.
 */
export function SplitBuilder({
  locale,
  exercises,
  shapes,
  questions,
  isRedo,
}: {
  locale: Locale;
  exercises: BuilderExercise[];
  shapes: SplitShape[];
  questions: BuilderQuestions;
  isRedo: boolean;
}) {
  const router = useRouter();
  const direction = dir(locale);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>(questions.gender.options[0]?.value ?? "Male");
  const [goal, setGoal] = useState<string>(questions.goal.options[0]?.value ?? "");
  const [experience, setExperience] = useState<string>(questions.experience.options[0]?.value ?? "");
  const [dayCount, setDayCount] = useState(4);
  const [days, setDays] = useState<DraftDay[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  /** Shapes that match what they just asked for, so the list is short. */
  const matchingShapes = useMemo(
    () =>
      shapes.filter(
        (s) => s.daysPerWeek === dayCount && s.gender === (gender === "Female" ? "Female" : "Male"),
      ),
    [shapes, dayCount, gender],
  );

  /** Resize the draft to `count` days, keeping whatever is already filled in. */
  function applyDayCount(count: number) {
    setDayCount(count);
    setDays((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) {
        next.push({ name: `${locale === "tn" ? "نهار" : "Day"} ${next.length + 1}`, exercises: [] });
      }
      return next;
    });
    setActiveDay((current) => Math.min(current, count - 1));
  }

  /** Take a pre-built split's day *names* only — never its exercises. */
  function applyShape(shape: SplitShape | null) {
    if (!shape) {
      applyDayCount(dayCount);
      setDays((prev) =>
        prev.map((day, i) => ({ ...day, name: `${locale === "tn" ? "نهار" : "Day"} ${i + 1}` })),
      );
      return;
    }
    setDays(
      shape.dayNames.map((dayName) => ({
        name: pick(locale, dayName.en, dayName.ar),
        exercises: [],
      })),
    );
    setDayCount(shape.dayNames.length);
    setActiveDay(0);
  }

  function addExercise(dayIndex: number, exerciseId: string) {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        if (day.exercises.length >= MAX_PER_DAY) return day;
        if (day.exercises.some((e) => e.exerciseId === exerciseId)) return day;
        return {
          ...day,
          exercises: [...day.exercises, { exerciseId, ...DEFAULT_SCHEME }],
        };
      }),
    );
  }

  function updateExercise(dayIndex: number, exerciseId: string, patch: Partial<DraftExercise>) {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              exercises: day.exercises.map((e) =>
                e.exerciseId === exerciseId ? { ...e, ...patch } : e,
              ),
            }
          : day,
      ),
    );
  }

  function removeExercise(dayIndex: number, exerciseId: string) {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, exercises: day.exercises.filter((e) => e.exerciseId !== exerciseId) }
          : day,
      ),
    );
  }

  function renameDay(dayIndex: number, value: string) {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, name: value } : day)));
  }

  const emptyDayIndex = days.findIndex((d) => d.exercises.length === 0);
  const canSave = days.length >= MIN_DAYS && emptyDayIndex === -1;

  function save() {
    if (!canSave) {
      setError(t(locale, "cw.day_needs_exercise"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createCustomProgram({
        gender,
        goal,
        experience,
        name,
        days: days.map((day) => ({
          name: day.name,
          exercises: day.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets,
            repRange: e.repRange,
            restSeconds: e.restSeconds,
          })),
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/workout");
      router.refresh();
    });
  }

  return (
    <div dir={direction} className="flex flex-col gap-5">
      <StepBar
        locale={locale}
        step={step}
        labels={["cw.step_basics", "cw.step_shape", "cw.step_fill"]}
      />

      {/* ---- 1. who it's for ---- */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "cw.title")}</h1>

          <Field label={t(locale, "cw.program_name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={t(locale, "cw.program_name_ph")}
            />
          </Field>

          <ChoiceGroup
            label={questions.gender.title}
            options={questions.gender.options}
            value={gender}
            onChange={setGender}
          />
          <ChoiceGroup
            label={questions.goal.title}
            options={questions.goal.options}
            value={goal}
            onChange={setGoal}
          />
          <ChoiceGroup
            label={questions.experience.title}
            options={questions.experience.options}
            value={experience}
            onChange={setExperience}
          />

          <Button
            onClick={() => {
              if (days.length === 0) applyDayCount(dayCount);
              setStep(2);
            }}
            size="lg"
            className="w-full"
          >
            {t(locale, "co.next")}
          </Button>
          <SwitchLink locale={locale} isRedo={isRedo} />
        </div>
      )}

      {/* ---- 2. the shape of the week ---- */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-extrabold">{t(locale, "cw.days_count")}</h2>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => i + MIN_DAYS).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => applyDayCount(count)}
                className={cn(
                  "h-12 min-w-12 rounded-2xl border px-4 font-extrabold tabular-nums transition-colors",
                  dayCount === count
                    ? "border-accent bg-accent text-bg"
                    : "border-hairline bg-surface text-muted hover:text-ink",
                )}
              >
                {count}
              </button>
            ))}
            <span className="self-center ps-1 text-sm text-muted">{t(locale, "cw.days_unit")}</span>
          </div>

          {matchingShapes.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {t(locale, "cw.start_from")}
              </p>
              <p className="text-xs text-muted">{t(locale, "cw.start_from_hint")}</p>
              {matchingShapes.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => applyShape(shape)}
                  className="flex flex-col gap-1 rounded-2xl border border-hairline bg-surface px-4 py-3 text-start transition-colors hover:border-accent/50"
                >
                  <span className="font-bold">{shape.titleEn}</span>
                  <span className="text-xs text-muted">
                    {shape.dayNames.map((d) => pick(locale, d.en, d.ar)).join(" · ")}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyShape(null)}
                className="self-start text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                {t(locale, "cw.start_blank")}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {days.map((day, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-sm font-bold text-muted tabular-nums">
                  {i + 1}
                </span>
                <Input
                  value={day.name}
                  onChange={(e) => renameDay(i, e.target.value)}
                  maxLength={40}
                  aria-label={`${t(locale, "cw.day_name")} ${i + 1}`}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
              <ArrowLeft className="h-4 w-4" />
              {t(locale, "co.back")}
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1">
              {t(locale, "co.next")}
            </Button>
          </div>
        </div>
      )}

      {/* ---- 3. fill the days ---- */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveDay(i)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  activeDay === i
                    ? "bg-accent text-bg"
                    : "border border-hairline text-muted hover:text-ink",
                )}
              >
                {day.name}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    activeDay === i ? "bg-bg/20" : "bg-white/10",
                    day.exercises.length === 0 && activeDay !== i && "text-amber-400",
                  )}
                >
                  {day.exercises.length}
                </span>
              </button>
            ))}
          </div>

          {days[activeDay] && (
            <DayEditor
              locale={locale}
              day={days[activeDay]}
              exercises={exercises}
              byId={byId}
              onAdd={(id) => addExercise(activeDay, id)}
              onUpdate={(id, patch) => updateExercise(activeDay, id, patch)}
              onRemove={(id) => removeExercise(activeDay, id)}
            />
          )}

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <div className="sticky bottom-20 flex gap-2 md:bottom-4">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">
              <ArrowLeft className="h-4 w-4" />
              {t(locale, "co.back")}
            </Button>
            <Button onClick={save} disabled={isPending || !canSave} className="flex-[2]">
              {isPending ? t(locale, "build.saving") : t(locale, "cw.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One day's list, plus the picker that fills it. */
function DayEditor({
  locale,
  day,
  exercises,
  byId,
  onAdd,
  onUpdate,
  onRemove,
}: {
  locale: Locale;
  day: DraftDay;
  exercises: BuilderExercise[];
  byId: Map<string, BuilderExercise>;
  onAdd: (exerciseId: string) => void;
  onUpdate: (exerciseId: string, patch: Partial<DraftExercise>) => void;
  onRemove: (exerciseId: string) => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {day.exercises.length === 0 && !picking && (
        <p className="rounded-2xl border border-dashed border-hairline bg-surface px-4 py-8 text-center text-sm text-muted">
          {t(locale, "cw.empty_day")}
        </p>
      )}

      {day.exercises.map((entry) => {
        const exercise = byId.get(entry.exerciseId);
        if (!exercise) return null;
        const illustration = illustrationFor(exercise.nameEn);
        return (
          <div
            key={entry.exerciseId}
            className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-3"
          >
            <div className="flex items-center gap-3">
              {illustration ? (
                // eslint-disable-next-line @next/next/no-img-element -- pre-optimized local asset
                <img
                  src={illustration}
                  alt=""
                  loading="lazy"
                  className="h-10 w-[3.75rem] shrink-0 rounded-lg border border-hairline bg-[#161616] object-cover"
                />
              ) : (
                <span className="h-10 w-[3.75rem] shrink-0 rounded-lg border border-hairline bg-white/5" />
              )}
              <span className="min-w-0 flex-1 truncate font-bold">
                {pick(locale, exercise.nameEn, exercise.nameAr)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(entry.exerciseId)}
                aria-label={t(locale, "cw.remove")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline text-muted hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label={t(locale, "cw.sets")}
                value={entry.sets}
                min={1}
                max={10}
                onChange={(sets) => onUpdate(entry.exerciseId, { sets })}
              />
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  {t(locale, "cw.reps")}
                </span>
                <Input
                  value={entry.repRange}
                  onChange={(e) => onUpdate(entry.exerciseId, { repRange: e.target.value })}
                  inputMode="numeric"
                  maxLength={5}
                  className="h-10 text-center text-sm"
                />
              </label>
              <NumberField
                label={`${t(locale, "cw.rest")} (s)`}
                value={entry.restSeconds}
                min={0}
                max={600}
                step={15}
                onChange={(restSeconds) => onUpdate(entry.exerciseId, { restSeconds })}
              />
            </div>
          </div>
        );
      })}

      {picking ? (
        <ExercisePicker
          locale={locale}
          exercises={exercises}
          chosenIds={new Set(day.exercises.map((e) => e.exerciseId))}
          full={day.exercises.length >= MAX_PER_DAY}
          onPick={(id) => onAdd(id)}
          onClose={() => setPicking(false)}
        />
      ) : (
        <Button
          variant="secondary"
          onClick={() => setPicking(true)}
          disabled={day.exercises.length >= MAX_PER_DAY}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          {t(locale, "cw.add_exercise")}
        </Button>
      )}
    </div>
  );
}


function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        inputMode="numeric"
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))));
        }}
        className="h-10 text-center text-sm"
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-sm font-semibold transition-colors",
              value === option.value
                ? "border-accent bg-accent/5 text-ink ring-1 ring-accent"
                : "border-hairline bg-surface text-muted hover:text-ink",
            )}
          >
            {option.label}
            {value === option.value && <Check className="h-4 w-4 shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepBar({
  locale,
  step,
  labels,
}: {
  locale: Locale;
  step: number;
  labels: StringKey[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
        {t(locale, "co.step")} {step} {t(locale, "co.of")} {labels.length} ·{" "}
        {t(locale, labels[step - 1])}
      </p>
      <div className="flex gap-1.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < step ? "bg-accent" : "bg-white/10",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** The way back to the questionnaire, kept on screen the whole time. */
function SwitchLink({ locale, isRedo }: { locale: Locale; isRedo: boolean }) {
  return (
    <Link
      href={isRedo ? "/workout/questions?redo=1" : "/workout/questions"}
      className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      {t(locale, "build.switch_to_guided")}
    </Link>
  );
}
