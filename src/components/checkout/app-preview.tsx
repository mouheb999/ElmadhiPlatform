"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dumbbell,
  Home,
  Lock,
  MessageCircleQuestion,
  Sparkles,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, dir, t, type StringKey } from "@/lib/i18n";
import { AI_ITEMS, FOODS, type SlotKey } from "./preview-data";
import {
  AddFoodScreen,
  AiScreen,
  DiaryScreen,
  INITIAL_STATE,
  ProgramScreen,
  QaScreen,
  SessionScreen,
  TodayScreen,
  type PreviewState,
} from "./preview-screens";

/**
 * The product, running on the checkout screen.
 *
 * With the reverse trial off, a stranger goes landing page → price grid in
 * about a minute having seen nothing, and eight tier bullets are all that
 * carries belief. So the app goes on the page — and not as pictures of it. The
 * screens here are the app's screens with a sample account behind them, and
 * they work: open the session and tick sets off and the volume climbs, log
 * dinner and the ring closes, point the camera at a plate and its macros land
 * in the diary.
 *
 * The state is a handful of `useState`s instead of Postgres. That is the only
 * difference, and it is the point: somebody who has just moved their own
 * numbers understands what the subscription buys. Somebody who tapped a button
 * and got a price understands that we want money.
 *
 * The wall therefore waits. Every section is walkable and every control does
 * what it says, right up to **finishing the session** — which is the real paid
 * boundary in this product, recording rather than reading — and that is where
 * it asks. By then it is answering a question the reader has actually asked.
 */

/** iPhone 16: 393pt wide. The rest follows from that. */
const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 11;
const DEVICE_W = SCREEN_W + BEZEL * 2;
const DEVICE_H = SCREEN_H + BEZEL * 2;

type Tab = "today" | "workout" | "food" | "ai" | "qa";
/** A screen pushed on top of a tab, the way the real app pushes a route. */
type View = null | "session" | "addFood";

const TABS: { id: Tab; icon: typeof Home; label: StringKey }[] = [
  { id: "today", icon: Home, label: "nav.home" },
  { id: "workout", icon: Dumbbell, label: "nav.workouts" },
  { id: "food", icon: Utensils, label: "nav.nutrition" },
  { id: "ai", icon: Sparkles, label: "nav.ai" },
  { id: "qa", icon: MessageCircleQuestion, label: "nav.qa" },
];

export function AppPreview({
  locale,
  onPickPlan,
}: {
  locale: Locale;
  /** Sends the reader to the plans — the way out of the wall. */
  onPickPlan: () => void;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [view, setView] = useState<View>(null);
  const [state, setState] = useState<PreviewState>(INITIAL_STATE);
  const [aiPhase, setAiPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [locked, setLocked] = useState(false);

  const shell = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  /**
   * Fit the device to whatever column it lands in. Measured rather than
   * assumed: the checkout column is one width on a phone and another on a
   * desktop, and a hard-coded scale either overflows the narrow case or wastes
   * the wide one.
   */
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / DEVICE_W, 1));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Every navigation starts at the top, like a real push. */
  function go(next: Tab, nextView: View = null) {
    setTab(next);
    setView(nextView);
    setLocked(false);
    scroller.current?.scrollTo({ top: 0 });
  }

  function toggleSet(exerciseId: string, index: number) {
    setState((s) => ({
      ...s,
      sets: {
        ...s.sets,
        [exerciseId]: s.sets[exerciseId].map((done, i) => (i === index ? !done : done)),
      },
    }));
  }

  function logMeal(slot: SlotKey) {
    setState((s) => (s.logged.includes(slot) ? s : { ...s, logged: [...s.logged, slot] }));
  }

  function addFood(id: string) {
    const food = FOODS.find((f) => f.id === id);
    if (!food) return;
    setState((s) => ({
      ...s,
      extra: [...s.extra, { ...food, id: `${food.id}-${s.extra.length}` }],
    }));
    go("food");
  }

  function shoot() {
    setAiPhase("scanning");
    // Long enough to read as work happening, short enough not to feel broken.
    setTimeout(() => setAiPhase("done"), 1400);
  }

  function addEstimate() {
    const summed = AI_ITEMS.reduce(
      (acc, i) => ({
        kcal: acc.kcal + i.kcal,
        protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs,
        fat: acc.fat + i.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    setState((s) => ({
      ...s,
      extra: [...s.extra, { id: `ai-${s.extra.length}`, name: "tour.ai_i1" as StringKey, ...summed }],
    }));
    setAiPhase("idle");
    // Straight to the diary, because the point of the camera is what it does
    // to the day's numbers, and that is a different screen.
    go("food");
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-xl font-extrabold tracking-tight">{t(locale, "tour.title")}</h2>
        <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">{t(locale, "tour.sub")}</p>
      </div>

      <div ref={shell} className="mx-auto w-full max-w-[340px]">
        <div
          style={{
            width: DEVICE_W * scale,
            height: DEVICE_H * scale,
            visibility: scale ? "visible" : "hidden",
          }}
          className="relative mx-auto"
        >
          <div
            style={{
              width: DEVICE_W,
              height: DEVICE_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0"
          >
            <div
              className="relative h-full w-full rounded-[58px] p-[11px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
              style={{
                background:
                  "linear-gradient(160deg,#6f7266 0%,#2b2d26 28%,#4a4d43 62%,#232520 100%)",
              }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[47px] bg-bg" dir={dir(locale)}>
                <StatusBar />

                {/* Scrolls, because these are real screens and a session with
                    five exercises is taller than a phone. */}
                <div
                  ref={scroller}
                  className="absolute inset-x-0 bottom-0 top-[52px] flex flex-col overflow-y-auto overflow-x-hidden px-4 pb-[104px] pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {tab === "today" && (
                    <TodayScreen
                      locale={locale}
                      state={state}
                      onStart={() => go("workout", "session")}
                      onFood={() => go("food")}
                    />
                  )}

                  {tab === "workout" && view !== "session" && (
                    <ProgramScreen locale={locale} onStart={() => go("workout", "session")} />
                  )}
                  {tab === "workout" && view === "session" && (
                    <SessionScreen
                      locale={locale}
                      state={state}
                      onToggleSet={toggleSet}
                      onBack={() => go("workout")}
                      onFinish={() => setLocked(true)}
                    />
                  )}

                  {tab === "food" && view !== "addFood" && (
                    <DiaryScreen
                      locale={locale}
                      state={state}
                      onLogMeal={logMeal}
                      onAdd={() => go("food", "addFood")}
                    />
                  )}
                  {tab === "food" && view === "addFood" && (
                    <AddFoodScreen locale={locale} onPick={addFood} onBack={() => go("food")} />
                  )}

                  {tab === "ai" && (
                    <AiScreen locale={locale} phase={aiPhase} onShoot={shoot} onAdd={addEstimate} />
                  )}

                  {tab === "qa" && <QaScreen locale={locale} />}
                </div>

                <PaywallSheet
                  locale={locale}
                  open={locked}
                  onClose={() => setLocked(false)}
                  onPickPlan={onPickPlan}
                />

                <PillNav locale={locale} tab={tab} onChange={(next) => go(next)} />

                <span
                  aria-hidden
                  className="absolute bottom-[8px] left-1/2 z-40 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-white/35"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onPickPlan}
        className="self-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
      >
        {t(locale, "tour.skip")}
      </button>
    </section>
  );
}

/** Dynamic Island, clock and the three right-hand glyphs. */
function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[52px] bg-bg" dir="ltr">
      <span className="absolute left-1/2 top-[11px] h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
      <span className="absolute start-[30px] top-[15px] font-display text-[15px] font-bold tracking-tight text-ink">
        9:41
      </span>
      <span className="absolute end-[26px] top-[17px] flex items-end gap-[5px]">
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} style={{ height: h }} className="w-[3px] rounded-[1px] bg-ink" />
          ))}
        </span>
        <svg width="15" height="11" viewBox="0 0 16 12" fill="none" aria-hidden>
          <path d="M8 10.5 5.8 8.2a3.1 3.1 0 0 1 4.4 0L8 10.5Z" fill="currentColor" className="text-ink" />
          <path d="M3.4 5.8a6.5 6.5 0 0 1 9.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
          <path d="M1 3.4a9.9 9.9 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
        </svg>
        <span className="relative flex h-[11px] w-[23px] items-center rounded-[3.5px] border border-ink/50 p-[1.5px]">
          <span className="h-full w-[70%] rounded-[2px] bg-ink" />
          <span className="absolute -end-[3px] top-1/2 h-[4px] w-[2px] -translate-y-1/2 rounded-e-sm bg-ink/50" />
        </span>
      </span>
    </div>
  );
}

/** The app's own floating glass pill, icon-only, lime circle on the active tab. */
function PillNav({
  locale,
  tab,
  onChange,
}: {
  locale: Locale;
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="absolute inset-x-0 bottom-[28px] z-20 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-surface/85 p-1.5 shadow-[0_16px_30px_-16px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              aria-label={t(locale, label)}
              className="rounded-full outline-none transition-transform active:scale-90"
            >
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full transition-all duration-200",
                  active
                    ? "bg-accent text-bg shadow-[0_6px_16px_-4px_rgba(192,218,27,0.6)]"
                    : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * The upgrade sheet — the moment the preview exists for.
 *
 * It fires once, on finishing the session, after the reader has ticked sets
 * off and watched a day of food add up. Recording is the paid part of this
 * product, so this is the honest place for it and also the persuasive one: it
 * arrives naming what they just did rather than interrupting them to do it.
 */
function PaywallSheet({
  locale,
  open,
  onClose,
  onPickPlan,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onPickPlan: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "absolute inset-0 z-20 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 rounded-t-[32px] border-t border-white/10 bg-surface px-6 pb-8 pt-3 shadow-[0_-24px_60px_-12px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
      >
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/20" />
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15">
            <Lock className="h-[22px] w-[22px] text-accent" />
          </span>
          <h3 className="font-display text-lg font-extrabold leading-tight">
            {t(locale, "tour.lock_save_title")}
          </h3>
          <p className="max-w-[32ch] text-[12.5px] leading-relaxed text-muted">
            {t(locale, "tour.lock_save_body")}
          </p>
          <button
            type="button"
            onClick={onPickPlan}
            tabIndex={open ? 0 : -1}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-accent font-display text-[15px] font-bold text-bg shadow-[0_10px_28px_rgba(192,218,27,0.25)] transition-transform active:scale-[0.97]"
          >
            {t(locale, "tour.lock_cta")}
          </button>
          <button
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className="text-[11.5px] font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            {t(locale, "tour.lock_back")}
          </button>
        </div>
      </div>
    </>
  );
}
