"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Check,
  Flame,
  Play,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import { CheckinCard, type TodayCheckin } from "@/components/dashboard/checkin-card";
import { NutritionLiveTile } from "@/components/dashboard/nutrition-live-tile";
import { ProgressTeaser } from "@/components/dashboard/progress-teaser";
import { QaSpark } from "@/components/dashboard/qa-spark";
import { TodayWorkout } from "@/components/dashboard/today-workout";
import { IngredientPicker, type IngredientOption } from "@/components/diet/ingredient-picker";
import { MacroRing } from "@/components/diet/macro-ring";
import { MealCard, type EditorItem } from "@/components/diet/meal-card";
import { QaCard } from "@/components/qa/qa-card";
import { cn } from "@/lib/utils";
import { type Locale, t, type StringKey } from "@/lib/i18n";
import { AI_ITEMS, PROGRAM } from "./preview-data";
import {
  macrosOf,
  SAMPLE_DAY,
  SAMPLE_EATEN,
  SAMPLE_INGREDIENTS,
  SAMPLE_LAST_WEIGHT,
  SAMPLE_MEALS,
  SAMPLE_QA,
  SAMPLE_QA_SPARK,
  SAMPLE_STREAK,
  SAMPLE_TARGET,
  SAMPLE_WEEK,
  SAMPLE_WEIGHTS,
  sumMacros,
} from "./preview-account";

/**
 * The screens inside the phone on /checkout.
 *
 * These are the app's screens. Not a likeness of them — the components
 * themselves: `TodayWorkout`, `CheckinCard`, `ProgressTeaser`,
 * `NutritionLiveTile`, `QaSpark`, `MacroRing`, `MealCard`, `IngredientPicker`,
 * `QaCard`, imported from the same files `/dashboard` and `/diet` import them
 * from. The only thing this file supplies is a sample account and a handful of
 * `useState`s where the database would be.
 *
 * It used to be a second implementation, and that was the problem. A preview
 * built out of lookalike cards drifts away from the product it is selling, and
 * it drifts in one direction only — the real screens get worked on, the replica
 * does not. A stranger deciding whether to pay was being shown a slightly worse
 * app than the one they would get.
 *
 * Now a change to any real card shows up here on the next build, and a change
 * to its props is a compile error rather than a silent lie.
 *
 * What is still this file's own: the workout session and the camera. Both are
 * long, stateful screens wired to Server Functions that a signed-out visitor
 * cannot call, so they are rebuilt here at preview scale — and they are the two
 * that end in the paywall anyway.
 */

/** One meal of the day, exactly as the diet screen holds it. */
export type PreviewMealState = { slot: string; items: EditorItem[] };

export type PreviewState = {
  /** Per exercise, which sets have been ticked off. */
  sets: Record<string, boolean[]>;
  /** The day's meals. Portions are editable, so the items live here. */
  meals: PreviewMealState[];
  /** Which meals have been logged against the day — only these count. */
  eaten: string[];
  /** Anything added on top: from the picker or from the camera. */
  extra: EditorItem[];
  /** Today's check-in, once the visitor saves one. */
  checkin: TodayCheckin;
};

export const INITIAL_STATE: PreviewState = {
  sets: Object.fromEntries(PROGRAM.map((e) => [e.id, Array(e.sets).fill(false)])),
  meals: SAMPLE_MEALS.map((m) => ({ slot: m.slot, items: m.items.map((i) => ({ ...i })) })),
  eaten: [...SAMPLE_EATEN],
  extra: [],
  /**
   * Today's check-in, already done.
   *
   * Empty, the card opens as a two-field form with an inactive Save button —
   * the tallest, emptiest thing on the screen, in the spot where a stranger
   * forms their first impression of the product. Saved, it is the one-line
   * "checked in · 78.4 kg" row, which is what the app looks like when somebody
   * is using it rather than setting it up. The form is still one tap away on
   * "edit", and it still saves, because this is the real card.
   */
  checkin: { weightKg: 78.4, energy: 4, sleepHours: 7 },
};

/** Everything the screens show about the day, derived rather than stored. */
export function totals(state: PreviewState) {
  // Only logged meals count towards the day, which is what makes tapping
  // "log it" move the ring.
  const eatenItems = state.meals
    .filter((m) => state.eaten.includes(m.slot))
    .flatMap((m) => m.items);
  const macros = sumMacros([...eatenItems, ...state.extra].map(macrosOf));

  const done = Object.values(state.sets).flat().filter(Boolean).length;
  const total = Object.values(state.sets).flat().length;
  const volume = PROGRAM.reduce(
    (n, e) => n + (state.sets[e.id]?.filter(Boolean).length ?? 0) * e.weight * Number(e.reps),
    0,
  );
  return { macros, setsDone: done, setsTotal: total, volume };
}

/** A saved check-in, in the shape the real card hands back. */
export type SampleCheckin = {
  weightKg: number | null;
  energy: number | null;
  sleepHours: number | null;
};

/* ------------------------------------------------------------------ pieces */

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-hairline bg-surface p-4", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-max rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  icon: Icon,
  full = true,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: typeof Play;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-display text-[15px] font-bold text-bg shadow-[0_10px_28px_rgba(192,218,27,0.25)] transition-transform active:scale-[0.97]",
        full ? "w-full" : "w-max",
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {children}
    </button>
  );
}

function ScreenHeader({
  locale,
  title,
  sub,
  onBack,
}: {
  locale: Locale;
  title: string;
  sub?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t(locale, "tour.back")}
          className="-ms-1 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-[18px] w-[18px] rtl:rotate-180" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-lg font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/** The donut from MacroRing, at whatever size a screen needs. */
export function Donut({ pct, size, children }: { pct: number; size: number; children?: React.ReactNode }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="#C0DA1B"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(pct, 1))}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>}
    </span>
  );
}

export function TodayScreen({
  locale,
  state,
  onCheckin,
}: {
  locale: Locale;
  state: PreviewState;
  onCheckin: (checkin: SampleCheckin) => void;
}) {
  const sum = totals(state);

  /**
   * The real dashboard, with a sample account behind it.
   *
   * Every card below is the component `/dashboard` renders — same greeting
   * row, same hero, same check-in form, same sparkline, same nutrition tile,
   * same shuffle card. Nothing here is drawn twice.
   *
   * The one thing the preview supplies is where a saved check-in goes: there
   * is no account yet, so it goes into React state instead of Postgres, and
   * the card flips to its "done for today" row exactly as it would for a
   * customer. See `CheckinCard`'s `onSave`.
   */
  return (
    <div className="flex flex-col gap-5">
      {/* The greeting row is inline in the dashboard page rather than a
          component, so it is the one piece of markup this file restates. Kept
          identical on purpose — if it drifts, it drifts visibly. */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t(locale, "dashboard.greeting")}
          </p>
          <h2 className="text-lg font-extrabold">{t(locale, "tour.t_name")}</h2>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-bold">
            <Flame className="h-3.5 w-3.5 text-accent" />
            {SAMPLE_STREAK} {t(locale, "today.streak_label")}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-xs font-bold tabular-nums">
            {t(locale, "today.week_label")}: {SAMPLE_WEEK.done}/{SAMPLE_WEEK.target}{" "}
            {t(locale, "today.sessions_label")}
          </span>
        </div>
      </div>

      <TodayWorkout
        locale={locale}
        state={sum.setsDone > 0 ? "in_progress" : "ready"}
        day={SAMPLE_DAY}
      />

      <CheckinCard
        locale={locale}
        todayCheckin={state.checkin}
        lastWeightKg={SAMPLE_LAST_WEIGHT}
        onSave={async (checkin) => {
          onCheckin(checkin);
          return { ok: true };
        }}
      />

      <ProgressTeaser
        locale={locale}
        points={SAMPLE_WEIGHTS}
        weekDone={SAMPLE_WEEK.done}
        weekTarget={SAMPLE_WEEK.target}
      />

      <NutritionLiveTile locale={locale} target={SAMPLE_TARGET} consumed={sum.macros} />

      <QaSpark locale={locale} cards={SAMPLE_QA_SPARK} />
    </div>
  );
}

/* --------------------------------------------------------------- workout */

export function ProgramScreen({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const days: StringKey[] = ["tour.p_day1", "tour.p_day2", "tour.p_day3"];
  return (
    <div className="flex h-full flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.p_title")} sub={t(locale, "tour.p_meta")} />

      <div className="flex gap-2">
        {days.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex-1 rounded-full border px-2 py-1.5 text-center text-[11px] font-bold",
              i === 0 ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted",
            )}
          >
            {t(locale, d)}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {PROGRAM.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
            <span className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-xl border border-hairline bg-[#161616]">
              <Image src={e.img} alt="" fill sizes="72px" className="object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{t(locale, e.name)}</span>
              <span className="block text-[11px] text-muted">{t(locale, "tour.p_rest")}</span>
            </span>
            <span dir="ltr" className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted">
              {e.sets} × {e.reps}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <PrimaryButton onClick={onStart} icon={Play}>
          {t(locale, "tour.t_start")}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function SessionScreen({
  locale,
  state,
  onToggleSet,
  onBack,
  onFinish,
}: {
  locale: Locale;
  state: PreviewState;
  onToggleSet: (exerciseId: string, index: number) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const sum = totals(state);
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader
        locale={locale}
        title={t(locale, "tour.t_day")}
        sub={t(locale, "tour.s_tap")}
        onBack={onBack}
      />

      <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-2.5">
        <span className="text-[11px] text-muted">
          <bdi dir="ltr" className="font-display text-[15px] font-extrabold text-ink tabular-nums">
            {sum.setsDone}/{sum.setsTotal}
          </bdi>{" "}
          {t(locale, "tour.s_done")}
        </span>
        <span className="text-[11px] text-muted">
          {t(locale, "tour.s_volume")}{" "}
          <bdi dir="ltr" className="font-display text-[15px] font-extrabold text-accent tabular-nums">
            {(sum.volume / 1000).toFixed(1)}t
          </bdi>
        </span>
      </div>

      {PROGRAM.map((e) => {
        const done = state.sets[e.id] ?? [];
        return (
          <div key={e.id} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-3">
            <div className="flex items-center gap-3">
              <span className="relative h-11 w-[66px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-[#161616]">
                <Image src={e.img} alt="" fill sizes="66px" className="object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{t(locale, e.name)}</span>
                <bdi dir="ltr" className="block text-[11px] text-muted">
                  {e.sets} × {e.reps} · {e.weight} kg
                </bdi>
              </span>
            </div>

            <div className="grid grid-cols-[20px_1fr_1fr_38px] items-center gap-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-muted">
              <span>#</span>
              <span>{t(locale, "tour.s_kg")}</span>
              <span>{t(locale, "tour.s_reps")}</span>
              <span />
            </div>

            {done.map((isDone, i) => (
              <div key={i} className="grid grid-cols-[20px_1fr_1fr_38px] items-center gap-1.5">
                <span className="text-center text-[11px] font-bold text-muted">{i + 1}</span>
                <span
                  dir="ltr"
                  className={cn(
                    "grid h-9 place-items-center rounded-lg border border-hairline text-[13px] font-bold tabular-nums",
                    isDone ? "bg-white/[0.03] text-muted" : "text-ink",
                  )}
                >
                  {e.weight}
                </span>
                <span
                  dir="ltr"
                  className={cn(
                    "grid h-9 place-items-center rounded-lg border border-hairline text-[13px] font-bold tabular-nums",
                    isDone ? "bg-white/[0.03] text-muted" : "text-ink",
                  )}
                >
                  {e.reps}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleSet(e.id, i)}
                  aria-label={`${t(locale, e.name)} ${i + 1}`}
                  aria-pressed={isDone}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg border transition-colors",
                    isDone ? "border-accent bg-accent text-bg" : "border-hairline text-muted",
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ))}

            {done.some(Boolean) && !done.every(Boolean) && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
                <Timer className="h-3.5 w-3.5" />
                {t(locale, "tour.s_rest")}
              </p>
            )}
          </div>
        );
      })}

      <PrimaryButton onClick={onFinish} icon={Check}>
        {t(locale, "tour.s_finish")}
      </PrimaryButton>
    </div>
  );
}

/* ------------------------------------------------------------- nutrition */

export function DiaryScreen({
  locale,
  state,
  onLogMeal,
  onAdd,
  onQuantityChange,
}: {
  locale: Locale;
  state: PreviewState;
  onLogMeal: (slot: string) => void;
  onAdd: () => void;
  onQuantityChange: (slot: string, itemId: string, quantityG: number) => void;
}) {
  const sum = totals(state);

  /**
   * The nutrition screen, with the product's own `MacroRing` and `MealCard`.
   *
   * The meal cards are fully live: open one, drag a portion, and the ring
   * above recomputes from the same arithmetic the paid screen uses. That is
   * the moment this whole preview exists for — the reader changes a number
   * about their own day and watches the rest of the screen answer.
   */
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader locale={locale} title={t(locale, "tour.f_title")} />

      <MacroRing
        locale={locale}
        calories={Math.round(sum.macros.calories)}
        caloriesTarget={SAMPLE_TARGET.calories}
        proteinG={Math.round(sum.macros.proteinG)}
        proteinTargetG={SAMPLE_TARGET.proteinG}
        carbsG={Math.round(sum.macros.carbsG)}
        carbsTargetG={SAMPLE_TARGET.carbsG}
        fatG={Math.round(sum.macros.fatG)}
        fatTargetG={SAMPLE_TARGET.fatG}
        dailyTargetLabel={t(locale, "fn.r_daily")}
      />

      <div className="flex flex-col gap-3">
        {state.meals.map((meal) => {
          const eaten = state.eaten.includes(meal.slot);
          return (
            <div key={meal.slot} className="flex flex-col">
              <MealCard
                locale={locale}
                mealType={meal.slot}
                items={meal.items}
                ingredients={SAMPLE_INGREDIENTS}
                onQuantityChange={(itemId, quantityG) =>
                  onQuantityChange(meal.slot, itemId, quantityG)
                }
                onRemove={() => {}}
                onAdd={() => {}}
                onSwap={() => {}}
              />
              {/* The diary's own "I ate this" control, which is what turns a
                  plan into a logged day. Unlogged meals do not count towards
                  the ring, so tapping it is what moves the numbers. */}
              {/* Attached under the card rather than floating beside it —
                  it is that meal's control, and a loose pill in the gap reads
                  as belonging to neither card. */}
              <div
                className={cn(
                  "-mt-2 flex items-center justify-start rounded-b-2xl border border-t-0 px-3 pb-2 pt-3",
                  eaten ? "border-accent/25 bg-accent/[0.04]" : "border-hairline bg-surface",
                )}
              >
                {eaten ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
                    <Check className="h-3.5 w-3.5" />
                    {t(locale, "tour.f_logged")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLogMeal(meal.slot)}
                    className="rounded-full bg-accent px-3.5 py-1.5 font-display text-[11px] font-bold text-bg transition-transform active:scale-95"
                  >
                    {t(locale, "tour.f_log")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-hairline py-3 text-[13px] font-bold text-accent transition-colors hover:bg-white/5"
      >
        <Plus className="h-4 w-4" />
        {t(locale, "tour.f_add")}
      </button>
    </div>
  );
}

export function AddFoodScreen({
  locale,
  onPick,
  onBack,
}: {
  locale: Locale;
  onPick: (ingredient: IngredientOption) => void;
  onBack: () => void;
}) {
  /** The product's own search-and-pick list, over a short sample catalogue. */
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.f_pick")} onBack={onBack} />
      <IngredientPicker
        locale={locale}
        ingredients={SAMPLE_INGREDIENTS}
        onPick={onPick}
        placeholder={t(locale, "diary.search_placeholder")}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- camera */

export function AiScreen({
  locale,
  phase,
  onShoot,
  onAdd,
}: {
  locale: Locale;
  phase: "idle" | "scanning" | "done";
  onShoot: () => void;
  onAdd: () => void;
}) {
  const total = AI_ITEMS.reduce((n, i) => n + i.kcal, 0);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.ai_title")}</h1>
        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="h-3 w-3" />
          {t(locale, "tour.ai_sub")}
        </span>
      </div>

      <div
        className={cn(
          "relative grid min-h-[140px] flex-1 place-items-center overflow-hidden rounded-3xl border bg-gradient-to-br from-white/[0.06] to-transparent",
          phase === "scanning" ? "border-accent/60" : "border-hairline",
        )}
      >
        <div className="glow-accent pointer-events-none absolute inset-0" />
        <Camera
          className={cn(
            "relative h-8 w-8",
            phase === "scanning" ? "animate-pulse text-accent" : "text-muted",
          )}
          aria-hidden
        />
        {phase === "scanning" && (
          <span className="absolute bottom-4 text-[11px] font-bold text-accent">
            {t(locale, "tour.ai_scan")}
          </span>
        )}
        {["start-4 top-4 border-s-2 border-t-2 rounded-ss-xl", "end-4 top-4 border-e-2 border-t-2 rounded-se-xl", "start-4 bottom-4 border-s-2 border-b-2 rounded-es-xl", "end-4 bottom-4 border-e-2 border-b-2 rounded-ee-xl"].map((c) => (
          <span key={c} className={cn("absolute h-5 w-5 border-accent/70", c)} aria-hidden />
        ))}
      </div>

      {phase === "done" && (
        <Card className="flex flex-col gap-2.5 p-3">
          {AI_ITEMS.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15">
                <Check className="h-3 w-3 text-accent" aria-hidden />
              </span>
              <span className="flex-1 truncate text-[12px] font-semibold">{t(locale, item.name)}</span>
              <bdi dir="ltr" className="text-[12px] font-bold tabular-nums text-muted">
                {item.kcal} kcal
              </bdi>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-hairline pt-2.5">
            <span className="text-[12px] font-bold">{t(locale, "diary.totals")}</span>
            <bdi dir="ltr" className="font-display text-[15px] font-extrabold tabular-nums text-accent">
              {total} kcal
            </bdi>
          </div>
        </Card>
      )}

      <div className="mt-auto">
        {phase === "done" ? (
          <PrimaryButton onClick={onAdd} icon={Plus}>
            {t(locale, "tour.ai_add")}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onShoot} icon={Camera}>
            {t(locale, "tour.ai_shoot")}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- q&a */

export function QaScreen({ locale }: { locale: Locale }) {
  /**
   * `/qa`, with three real rows from the library.
   *
   * `QaCard` is the product's own — same icon per category, same two-line
   * clamp, same chevron. It is a `<Link>` into the full answer; inside the
   * phone frame that navigation is swallowed (see `AppPreview`), so a tap
   * shows the pressed state and goes nowhere, which is the honest behaviour
   * for a card whose answer is behind the subscription.
   */
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.qa_title")} />
      {SAMPLE_QA.map((card) => (
        <QaCard key={card.id} locale={locale} card={card} />
      ))}
    </div>
  );
}
