"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  MessageCircleQuestion,
  Play,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, t, type StringKey } from "@/lib/i18n";
import {
  AI_ITEMS,
  FOODS,
  MEALS,
  PROGRAM,
  QA_CARDS,
  TARGETS,
  type SlotKey,
} from "./preview-data";

/**
 * The screens inside the phone on /checkout.
 *
 * These are not pictures of the app. They are the app's screens with a sample
 * account behind them, and they work: you open the session and tick sets off
 * and watch the volume climb, you log dinner and watch the ring close, you
 * point the camera at a plate and the macros it finds land in the diary. The
 * state is a few `useState`s rather than a database, and that is the only
 * difference.
 *
 * That is the whole argument for building it this way. A reader who has just
 * moved their own numbers has understood what the subscription is for; a
 * reader who tapped a button and got a price has understood that we want money.
 * The wall waits until the end, on the one action that is genuinely the paid
 * part — saving the day — because by then it is answering a question they have
 * actually asked.
 */

export type PreviewState = {
  /** Per exercise, which sets have been ticked off. */
  sets: Record<string, boolean[]>;
  /** Which meals of the plan have been eaten. */
  logged: SlotKey[];
  /** Anything added on top: from the food list or from the camera. */
  extra: { id: string; name: StringKey; kcal: number; protein: number; carbs: number; fat: number }[];
};

export const INITIAL_STATE: PreviewState = {
  sets: Object.fromEntries(PROGRAM.map((e) => [e.id, Array(e.sets).fill(false)])),
  logged: ["breakfast", "lunch"],
  extra: [],
};

/** Everything the screens show about the day, derived rather than stored. */
export function totals(state: PreviewState) {
  const eaten = MEALS.filter((m) => state.logged.includes(m.slot));
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") =>
    eaten.reduce((n, m) => n + m[k], 0) + state.extra.reduce((n, e) => n + e[k], 0);
  const done = Object.values(state.sets).flat().filter(Boolean).length;
  const total = Object.values(state.sets).flat().length;
  const volume = PROGRAM.reduce(
    (n, e) => n + (state.sets[e.id]?.filter(Boolean).length ?? 0) * e.weight * Number(e.reps),
    0,
  );
  return {
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
    setsDone: done,
    setsTotal: total,
    volume,
  };
}

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

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold">{label}</span>
          <bdi dir="ltr" className="tabular-nums text-muted">
            {Math.round(value)}g / {target}g
          </bdi>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.min((value / target) * 100, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- today */

export function TodayScreen({
  locale,
  state,
  onStart,
  onFood,
}: {
  locale: Locale;
  state: PreviewState;
  onStart: () => void;
  onFood: () => void;
}) {
  const sum = totals(state);
  const inProgress = sum.setsDone > 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t(locale, "tour.t_greeting")}
          </p>
          <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.t_name")}</h1>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold">
          <Flame className="h-3.5 w-3.5 text-accent" />
          {t(locale, "tour.t_streak")}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-5">
        <div className="glow-accent pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-2.5">
          <Eyebrow>{t(locale, "tour.t_workout")}</Eyebrow>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{t(locale, "tour.t_day")}</h2>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Dumbbell className="h-4 w-4" />
            {inProgress ? (
              <bdi dir="ltr">
                {sum.setsDone} / {sum.setsTotal} {t(locale, "tour.s_done")}
              </bdi>
            ) : (
              t(locale, "tour.t_meta")
            )}
          </p>
          <div className="mt-1">
            <PrimaryButton onClick={onStart} icon={Play} full={false}>
              {t(locale, "tour.t_start")}
            </PrimaryButton>
          </div>
        </div>
      </div>

      <button type="button" onClick={onFood} className="text-start">
        <Card className="flex items-center gap-3">
          <Donut pct={sum.kcal / TARGETS.kcal} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{t(locale, "tour.f_title")}</p>
            <bdi dir="ltr" className="block text-[11px] text-muted">
              {sum.kcal} / {TARGETS.kcal} kcal
            </bdi>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" />
        </Card>
      </button>

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold">{t(locale, "tour.t_checkin")}</p>
          <p className="text-[11px] text-muted">
            {t(locale, "tour.t_weight")} · <bdi dir="ltr">78.4 kg</bdi>
          </p>
        </div>
        <span className="flex h-9 items-center rounded-full border border-hairline px-3 text-[12px] font-bold tabular-nums text-accent">
          <bdi dir="ltr">2 / 3</bdi>
        </span>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <p className="text-[13px] font-bold">{t(locale, "tour.t_progress")}</p>
          <bdi dir="ltr" className="text-[11px] font-bold tabular-nums text-accent">−2.6 kg</bdi>
        </div>
        <div dir="ltr">
          <Sparkline />
        </div>
      </Card>
    </div>
  );
}

function Sparkline() {
  const points = [81.0, 80.6, 80.7, 80.1, 79.6, 79.4, 78.7, 78.4];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 30 - ((v - min) / (max - min)) * 26 - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id="tour-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C0DA1B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#C0DA1B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L100,32 L0,32 Z`} fill="url(#tour-spark)" />
      <path d={path} fill="none" stroke="#C0DA1B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
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
}: {
  locale: Locale;
  state: PreviewState;
  onLogMeal: (slot: SlotKey) => void;
  onAdd: () => void;
}) {
  const sum = totals(state);
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.f_title")} />

      <Card className="flex items-center gap-4">
        <Donut pct={sum.kcal / TARGETS.kcal} size={92}>
          <bdi dir="ltr" className="font-display text-xl font-extrabold leading-none">
            {sum.kcal}
          </bdi>
          <span className="mt-0.5 text-[9px] text-muted">/ {TARGETS.kcal} kcal</span>
        </Donut>
        <div className="flex flex-1 flex-col gap-2">
          <MacroBar label={t(locale, "diary.macro_protein")} value={sum.protein} target={TARGETS.protein} color="#C0DA1B" />
          <MacroBar label={t(locale, "diary.macro_carbs")} value={sum.carbs} target={TARGETS.carbs} color="#F5A623" />
          <MacroBar label={t(locale, "diary.macro_fat")} value={sum.fat} target={TARGETS.fat} color="#B76CFF" />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {MEALS.map((m) => {
          const eaten = state.logged.includes(m.slot);
          return (
            <div
              key={m.slot}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors",
                eaten ? "border-accent/30 bg-accent/[0.04]" : "border-hairline bg-surface",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">{t(locale, m.label)}</span>
                <span className="block truncate text-[11px] text-muted">{t(locale, m.items)}</span>
              </span>
              {eaten ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-accent">
                  <Check className="h-3.5 w-3.5" />
                  <bdi dir="ltr">{m.kcal} kcal</bdi>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onLogMeal(m.slot)}
                  className="shrink-0 rounded-full bg-accent px-3 py-1.5 font-display text-[11px] font-bold text-bg transition-transform active:scale-95"
                >
                  {t(locale, "tour.f_log")}
                </button>
              )}
            </div>
          );
        })}

        {state.extra.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/[0.04] p-3"
          >
            <span className="truncate text-[13px] font-bold">{t(locale, e.name)}</span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-accent">
              <Check className="h-3.5 w-3.5" />
              <bdi dir="ltr">{e.kcal} kcal</bdi>
            </span>
          </div>
        ))}
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
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.f_pick")} onBack={onBack} />
      <div className="flex flex-col gap-2">
        {FOODS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3 text-start transition-colors hover:border-accent/40"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{t(locale, f.name)}</span>
              <bdi dir="ltr" className="block text-[11px] text-muted">
                P {f.protein} · C {f.carbs} · F {f.fat}
              </bdi>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <bdi dir="ltr" className="text-[12px] font-bold tabular-nums text-muted">
                {f.kcal} kcal
              </bdi>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-bg">
                <Plus className="h-4 w-4" />
              </span>
            </span>
          </button>
        ))}
      </div>
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
  const [open, setOpen] = useState<number | null>(null);

  if (open !== null) {
    const card = QA_CARDS[open];
    return (
      <div className="flex flex-col gap-3">
        <ScreenHeader locale={locale} title={t(locale, "tour.qa_title")} onBack={() => setOpen(null)} />
        <Card className="flex flex-col gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15">
            <MessageCircleQuestion className="h-5 w-5 text-accent" aria-hidden />
          </span>
          <p className="text-[15px] font-extrabold leading-snug">{t(locale, card.q)}</p>
          <p className="text-[12.5px] leading-relaxed text-muted">{t(locale, card.a)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader locale={locale} title={t(locale, "tour.qa_title")} />
      {QA_CARDS.map((c, i) => (
        <button key={c.q} type="button" onClick={() => setOpen(i)} className="text-start">
          <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3 transition-colors hover:bg-white/5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15">
              <MessageCircleQuestion className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold leading-snug">{t(locale, c.q)}</span>
              <span className="line-clamp-1 text-[11px] text-muted">{t(locale, c.a)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" />
          </div>
        </button>
      ))}
    </div>
  );
}
