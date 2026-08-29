"use client";

import { useState } from "react";
import {
  Camera,
  Check,
  Dumbbell,
  Flame,
  Home,
  Lock,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Locale, t, type StringKey } from "@/lib/i18n";

/**
 * The product, played back on the checkout screen.
 *
 * With the reverse trial off, a stranger goes landing page → sign-up → price
 * grid in about a minute, having seen nothing. Nine hundred and fifty-nine
 * accounts have now met that price; seven subscribe. The tier bullets are the
 * only thing carrying belief, and "Diet & Workout Makers" does not carry it.
 *
 * So the screens themselves go on the page, and they are walkable: four tabs,
 * real navigation, sample numbers. Every action *inside* a screen — start the
 * session, swap a meal, take a photo — is the moment the product would become
 * personal, and every one of them raises the same wall, which explains what
 * happens when you pay and drops you at the plans.
 *
 * Two rules this is built on:
 *
 *  - It is labelled sample data, visibly, on every screen. A preview that
 *    passes itself off as the customer's own plan is a lie they find out about
 *    ten seconds after paying, which is the worst possible moment.
 *  - It renders from the app's own tokens (bg / surface / accent / hairline)
 *    rather than screenshots. Screenshots go stale silently and are never
 *    translated; this is right in both languages and cannot drift out of date
 *    without somebody noticing in review.
 */

type Tab = "today" | "program" | "food" | "ai";

const TABS: { id: Tab; icon: typeof Home; label: StringKey }[] = [
  { id: "today", icon: Home, label: "nav.home" },
  { id: "program", icon: Dumbbell, label: "nav.workouts" },
  { id: "food", icon: Utensils, label: "nav.nutrition" },
  { id: "ai", icon: Camera, label: "nav.ai" },
];

export function AppPreview({
  locale,
  onPickPlan,
}: {
  locale: Locale;
  /** Sends the reader to the plans — the only way out of the wall. */
  onPickPlan: () => void;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [locked, setLocked] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="text-center">
        <h2 className="font-display text-lg font-extrabold">{t(locale, "tour.title")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t(locale, "tour.sub")}</p>
      </div>

      {/* A thin bezel, not a full phone mock: the reader is already holding a
          phone, and a phone drawn inside a phone wastes the width the screens
          need to be legible. */}
      <div className="relative overflow-hidden rounded-[22px] border border-hairline bg-bg shadow-card">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
          <span className="font-display text-[11px] font-bold tracking-wide text-muted">
            HYPE
          </span>
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
            {t(locale, "tour.sample")}
          </span>
        </div>

        <div className="relative min-h-[320px] p-3">
          {tab === "today" && <TodayScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "program" && <ProgramScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "food" && <FoodScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "ai" && <AiScreen locale={locale} onLock={() => setLocked(true)} />}

          {locked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/95 p-5 text-center backdrop-blur-sm">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15">
                <Lock className="h-5 w-5 text-accent" />
              </span>
              <p className="font-display text-base font-extrabold">
                {t(locale, "tour.lock_title")}
              </p>
              <p className="max-w-[34ch] text-xs leading-relaxed text-muted">
                {t(locale, "tour.lock_body")}
              </p>
              <Button size="sm" onClick={onPickPlan} className="mt-1">
                {t(locale, "tour.lock_cta")}
              </Button>
              <button
                type="button"
                onClick={() => setLocked(false)}
                className="text-[11px] font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                {t(locale, "tour.lock_back")}
              </button>
            </div>
          )}
        </div>

        {/* The real app's bottom nav, in the same order. Switching tabs is free;
            it is the controls *inside* a screen that meet the wall. */}
        <div className="flex border-t border-hairline">
          {TABS.map(({ id, icon: Icon, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setLocked(false);
                  setTab(id);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(locale, label)}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onPickPlan}
        className="self-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        {t(locale, "tour.skip")}
      </button>
    </section>
  );
}

/* ---------------------------------------------------------------- screens */

/** The shell every faux screen sits in, so they share one rhythm. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-hairline bg-surface p-3", className)}>
      {children}
    </div>
  );
}

/** A control that exists to be tapped and refused. */
function LockedAction({
  locale,
  label,
  onLock,
}: {
  locale: Locale;
  label: StringKey;
  onLock: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onLock}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-xs font-bold text-bg transition-transform hover:-translate-y-0.5"
    >
      {t(locale, label)}
    </button>
  );
}

function TodayScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t(locale, "tour.t_greeting")}
          </p>
          <p className="font-display text-base font-extrabold">{t(locale, "tour.t_name")}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-hairline px-2 py-1 text-[10px] font-bold">
            <Flame className="h-3 w-3 text-accent" />
            {t(locale, "tour.t_streak")}
          </span>
        </div>
      </div>

      <Panel>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {t(locale, "tour.t_workout")}
        </p>
        <p className="mt-1 font-display text-lg font-extrabold">{t(locale, "tour.t_day")}</p>
        <p className="text-[11px] text-muted">{t(locale, "tour.t_meta")}</p>
        <LockedAction locale={locale} label="tour.t_start" onLock={onLock} />
      </Panel>

      <Panel className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold">{t(locale, "tour.t_checkin")}</p>
          <p className="text-[10px] text-muted">
            {t(locale, "tour.t_weight")} · <bdi dir="ltr">78.4 kg</bdi>
          </p>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-accent">{t(locale, "tour.t_week")}</span>
      </Panel>
    </div>
  );
}

function ProgramScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const days: StringKey[] = ["tour.p_day1", "tour.p_day2", "tour.p_day3"];
  const rows: { name: StringKey; sets: string }[] = [
    { name: "tour.p_ex1", sets: "4 × 8" },
    { name: "tour.p_ex2", sets: "3 × 10" },
    { name: "tour.p_ex3", sets: "3 × 15" },
    { name: "tour.p_ex4", sets: "3 × 12" },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="font-display text-base font-extrabold">{t(locale, "tour.p_title")}</p>
        <p className="text-[11px] text-muted">{t(locale, "tour.p_meta")}</p>
      </div>

      <div className="flex gap-1.5">
        {days.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex-1 rounded-full border px-2 py-1 text-center text-[10px] font-bold",
              i === 0 ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted",
            )}
          >
            {t(locale, d)}
          </span>
        ))}
      </div>

      <Panel className="flex flex-col gap-2 p-0">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center justify-between px-3 py-2",
              i > 0 && "border-t border-hairline",
            )}
          >
            <span className="text-[11px] font-semibold">{t(locale, r.name)}</span>
            {/* dir="ltr": "4 × 8" is entirely neutral characters, so inside
                the Arabic screen it inherits RTL and renders as "8 × 4". */}
            <span dir="ltr" className="text-[11px] font-bold tabular-nums text-muted">
              {r.sets}
            </span>
          </div>
        ))}
      </Panel>

      <LockedAction locale={locale} label="tour.p_swap" onLock={onLock} />
    </div>
  );
}

function FoodScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const meals: { slot: StringKey; items: StringKey; kcal: number }[] = [
    { slot: "tour.f_b", items: "tour.f_b_items", kcal: 520 },
    { slot: "tour.f_l", items: "tour.f_l_items", kcal: 780 },
    { slot: "tour.f_d", items: "tour.f_d_items", kcal: 640 },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="font-display text-base font-extrabold">{t(locale, "tour.f_title")}</p>
      </div>

      <Panel className="flex items-center justify-between">
        <div>
          <bdi dir="ltr" className="font-display text-2xl font-extrabold tabular-nums text-accent">
            1940
          </bdi>
          <span className="ms-1 text-[10px] text-muted">kcal {t(locale, "tour.f_left")}</span>
        </div>
        <div className="flex gap-3 text-[10px] text-muted">
          <span>
            <b className="block font-display text-xs text-ink tabular-nums">148g</b>
            {t(locale, "diary.macro_protein")}
          </span>
          <span>
            <b className="block font-display text-xs text-ink tabular-nums">210g</b>
            {t(locale, "diary.macro_carbs")}
          </span>
          <span>
            <b className="block font-display text-xs text-ink tabular-nums">62g</b>
            {t(locale, "diary.macro_fat")}
          </span>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-2 p-0">
        {meals.map((m, i) => (
          <div
            key={m.slot}
            className={cn(
              "flex items-center justify-between px-3 py-2",
              i > 0 && "border-t border-hairline",
            )}
          >
            <span>
              <b className="block text-[11px] font-bold">{t(locale, m.slot)}</b>
              <span className="text-[10px] text-muted">{t(locale, m.items)}</span>
            </span>
            <bdi dir="ltr" className="text-[11px] font-bold tabular-nums text-muted">
              {m.kcal} kcal
            </bdi>
          </div>
        ))}
      </Panel>

      <LockedAction locale={locale} label="tour.f_swap" onLock={onLock} />
    </div>
  );
}

function AiScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const items: StringKey[] = ["tour.ai_i1", "tour.ai_i2", "tour.ai_i3"];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="font-display text-base font-extrabold">{t(locale, "tour.ai_title")}</p>
        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
          <Sparkles className="h-2.5 w-2.5" />
          {t(locale, "tour.ai_sub")}
        </span>
      </div>

      {/* Stands in for the photo. A stock plate photo would be someone else's
          dinner dressed up as a feature; an empty viewfinder is honest about
          being a drawing. */}
      <div className="grid h-24 place-items-center rounded-2xl border border-dashed border-hairline bg-surface">
        <Camera className="h-7 w-7 text-muted" aria-hidden />
      </div>

      <Panel className="flex flex-col gap-2 p-0">
        {items.map((item, i) => (
          <div
            key={item}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              i > 0 && "border-t border-hairline",
            )}
          >
            <Check className="h-3 w-3 shrink-0 text-accent" aria-hidden />
            <span className="flex-1 text-[11px] font-semibold">{t(locale, item)}</span>
            <bdi dir="ltr" className="text-[11px] font-bold tabular-nums text-muted">
              {[297, 195, 88][i]} kcal
            </bdi>
          </div>
        ))}
      </Panel>

      <LockedAction locale={locale} label="tour.ai_shoot" onLock={onLock} />
    </div>
  );
}
