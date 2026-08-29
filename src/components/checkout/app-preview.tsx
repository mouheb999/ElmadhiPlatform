"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  Check,
  Dumbbell,
  Flame,
  Home,
  Lock,
  MessageCircleQuestion,
  Play,
  Sparkles,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, dir, t, type StringKey } from "@/lib/i18n";

/**
 * The product, played back on the checkout screen — inside a phone.
 *
 * With the reverse trial off, a stranger goes landing page → sign-up → price
 * grid in about a minute having seen nothing. Nine hundred and fifty-nine
 * accounts have met that price; seven subscribe. Eight terse tier bullets are
 * all that carries belief, and "Diet & Workout Makers" does not carry it.
 *
 * So the screens go on the page — and they have to be the *real* screens. A
 * simplified sketch of an app is worse than no preview at all: it promises
 * something cheaper than what you are selling, and the customer prices what
 * they saw. Everything below is built from the components it is imitating:
 * the hero's accent gradient and radial glow from `TodayWorkout`, the donut and
 * its macro colours from `MacroRing`, the real exercise illustrations out of
 * /public, and the floating glass pill nav with its lime active circle from
 * `AppBottomNav`.
 *
 * Two rules it is held to:
 *
 *  - **Rendered at true density.** The canvas is a real 393pt iPhone screen,
 *    scaled down to fit the column. Type sizes, radii and spacing are the app's
 *    own numbers rather than shrunken approximations, which is the difference
 *    between "a screenshot of an app" and "a diagram of an app".
 *  - **Labelled as sample data.** A preview that passes itself off as the
 *    customer's own plan is a lie they discover ten seconds after paying.
 */

/** iPhone 16: 393pt wide. The rest follows from that. */
const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 11;
const DEVICE_W = SCREEN_W + BEZEL * 2;
const DEVICE_H = SCREEN_H + BEZEL * 2;

type Tab = "today" | "program" | "food" | "ai" | "qa";

const TABS: { id: Tab; icon: typeof Home }[] = [
  { id: "today", icon: Home },
  { id: "program", icon: Dumbbell },
  { id: "food", icon: Utensils },
  { id: "ai", icon: Sparkles },
  { id: "qa", icon: MessageCircleQuestion },
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
  const [locked, setLocked] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  /**
   * Fit the device to whatever column it lands in.
   *
   * Measured rather than assumed: the checkout column is one width on a phone
   * and another on a desktop, and a hard-coded scale either overflows the
   * narrow case or wastes the wide one. `scale` starts at 0 so nothing paints
   * at the wrong size for a frame before the first measurement lands.
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

  return (
    <section className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-xl font-extrabold tracking-tight">
          {t(locale, "tour.title")}
        </h2>
        <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">{t(locale, "tour.sub")}</p>
      </div>

      <div ref={shell} className="mx-auto w-full max-w-[340px]">
        <div
          style={{
            width: DEVICE_W * scale,
            height: DEVICE_H * scale,
            // Nothing to look at until the shell has been measured.
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
            <Device locale={locale} tab={tab} setTab={setTab} locked={locked} setLocked={setLocked} onPickPlan={onPickPlan} />
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

/* ------------------------------------------------------------------ device */

function Device({
  locale,
  tab,
  setTab,
  locked,
  setLocked,
  onPickPlan,
}: {
  locale: Locale;
  tab: Tab;
  setTab: (t: Tab) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  onPickPlan: () => void;
}) {
  return (
    // The titanium band, then the black screen inside it. Two rings rather than
    // one border, because a real device has a bezel with its own highlight.
    <div
      className="relative h-full w-full rounded-[58px] p-[11px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      style={{
        background: "linear-gradient(160deg,#6f7266 0%,#2b2d26 28%,#4a4d43 62%,#232520 100%)",
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[47px] bg-bg" dir={dir(locale)}>
        <StatusBar />

        {/* Every screen is laid out for the space between the status bar and
            the floating nav, so switching tabs never reflows the device. */}
        <div className="absolute inset-x-0 bottom-0 top-[52px] flex flex-col overflow-hidden px-4 pb-[104px] pt-1">
          {tab === "today" && <TodayScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "program" && <ProgramScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "food" && <FoodScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "ai" && <AiScreen locale={locale} onLock={() => setLocked(true)} />}
          {tab === "qa" && <QaScreen locale={locale} onLock={() => setLocked(true)} />}
        </div>

        <PaywallSheet
          locale={locale}
          open={locked}
          onClose={() => setLocked(false)}
          onPickPlan={onPickPlan}
        />

        <PillNav locale={locale} tab={tab} onChange={(next) => { setLocked(false); setTab(next); }} />

        <span
          aria-hidden
          className="absolute bottom-[8px] left-1/2 z-40 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-white/35"
        />
      </div>
    </div>
  );
}

/** Dynamic Island, clock and the three right-hand glyphs. */
function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[52px]" dir="ltr">
      <span className="absolute left-1/2 top-[11px] h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
      <span className="absolute start-[30px] top-[15px] font-display text-[15px] font-bold tracking-tight text-ink">
        9:41
      </span>
      <span className="absolute end-[26px] top-[17px] flex items-end gap-[5px]">
        {/* signal */}
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} style={{ height: h }} className="w-[3px] rounded-[1px] bg-ink" />
          ))}
        </span>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 16 12" fill="none" aria-hidden>
          <path d="M8 10.5 5.8 8.2a3.1 3.1 0 0 1 4.4 0L8 10.5Z" fill="currentColor" className="text-ink" />
          <path d="M3.4 5.8a6.5 6.5 0 0 1 9.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
          <path d="M1 3.4a9.9 9.9 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
        </svg>
        {/* battery */}
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
        {TABS.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              aria-label={t(locale, TAB_LABELS[id])}
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

const TAB_LABELS: Record<Tab, StringKey> = {
  today: "nav.home",
  program: "nav.workouts",
  food: "nav.nutrition",
  ai: "nav.ai",
  qa: "nav.qa",
};

/* ------------------------------------------------------------------- parts */

/** The app's card: hairline border on the raised surface, generous radius. */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-hairline bg-surface p-4", className)}>
      {children}
    </div>
  );
}

/** The small lime capitals that head every section of the real app. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-max rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
      {children}
    </span>
  );
}

/** A primary control that exists to be tapped and refused. */
function LockedAction({
  locale,
  label,
  icon: Icon,
  onLock,
  full = true,
}: {
  locale: Locale;
  label: StringKey;
  icon?: typeof Play;
  onLock: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onLock}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-display text-[15px] font-bold text-bg shadow-[0_10px_28px_rgba(192,218,27,0.25)] transition-transform active:scale-[0.97]",
        full ? "w-full" : "w-max",
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {t(locale, label)}
    </button>
  );
}

/** Says out loud that these are not the reader's numbers. */
function SampleTag({ locale }: { locale: Locale }) {
  return (
    <span className="rounded-full border border-hairline px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
      {t(locale, "tour.sample")}
    </span>
  );
}

/* ----------------------------------------------------------------- screens */

function TodayScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t(locale, "tour.t_greeting")}
          </p>
          <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.t_name")}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold">
            <Flame className="h-3.5 w-3.5 text-accent" />
            {t(locale, "tour.t_streak")}
          </span>
          <SampleTag locale={locale} />
        </div>
      </div>

      {/* The hero, with the accent gradient and radial glow the real one has. */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-5">
        <div className="glow-accent pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-2.5">
          <Eyebrow>{t(locale, "tour.t_workout")}</Eyebrow>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
            {t(locale, "tour.t_day")}
          </h2>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Dumbbell className="h-4 w-4" />
            {t(locale, "tour.t_meta")}
          </p>
          <div className="mt-1">
            <LockedAction locale={locale} label="tour.t_start" icon={Play} onLock={onLock} full={false} />
          </div>
        </div>
      </div>

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

      <Card className="flex items-center gap-3">
        <MiniDonut pct={0.62} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">{t(locale, "tour.f_title")}</p>
          <p className="text-[11px] text-muted">
            <bdi dir="ltr">1210 / 1940 kcal</bdi>
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-accent">
          {t(locale, "tour.t_on_track")}
        </span>
      </Card>

      {/* The weight trend. On the real Today screen too, and the one card that
          shows the product doing the thing people actually buy it for. Time
          runs left to right in the chart even when the UI runs right to left —
          a mirrored time axis is a different claim about the data. */}
      <Card className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <p className="text-[13px] font-bold">{t(locale, "tour.t_progress")}</p>
          <bdi dir="ltr" className="text-[11px] font-bold tabular-nums text-accent">
            −2.6 kg
          </bdi>
        </div>
        <div dir="ltr">
          <Sparkline />
        </div>
      </Card>

      {/* The dashed card that ends the real Today screen. */}
      <div className="rounded-2xl border border-dashed border-accent/35 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <MessageCircleQuestion className="h-3.5 w-3.5" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t(locale, "tour.qa_title")}
          </span>
        </div>
        <p className="mt-2.5 text-[13px] font-bold leading-snug">{t(locale, "tour.qa_q1")}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t(locale, "tour.qa_a1")}</p>
      </div>
    </div>
  );
}

/** Eight weeks of weight, going the right way. */
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
      <circle cx="100" cy={(30 - ((points[points.length - 1] - min) / (max - min)) * 26 - 2).toFixed(1)} r="2.2" fill="#C0DA1B" />
    </svg>
  );
}

function ProgramScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const days: StringKey[] = ["tour.p_day1", "tour.p_day2", "tour.p_day3"];
  const rows: { name: StringKey; sets: string; img: string }[] = [
    { name: "tour.p_ex1", sets: "4 × 8", img: "/exercise-library/chest/barbell-bench-press.webp" },
    { name: "tour.p_ex2", sets: "3 × 10", img: "/exercise-library/chest/incline-dumbbell-press.webp" },
    { name: "tour.p_ex3", sets: "3 × 15", img: "/exercise-library/shoulders/lateral-raise.webp" },
    { name: "tour.p_ex4", sets: "3 × 12", img: "/exercise-library/triceps/triceps-pushdown.webp" },
    { name: "tour.p_ex5", sets: "3 × 12", img: "/exercise-library/chest/cable-crossover.webp" },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.p_title")}</h1>
          <p className="text-[11px] text-muted">{t(locale, "tour.p_meta")}</p>
        </div>
        <SampleTag locale={locale} />
      </div>

      <div className="flex gap-2">
        {days.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex-1 rounded-full border px-2 py-1.5 text-center text-[11px] font-bold",
              i === 0
                ? "border-accent bg-accent/10 text-accent"
                : "border-hairline text-muted",
            )}
          >
            {t(locale, d)}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3"
          >
            {/* The real illustrations, straight out of /public. */}
            <span className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-xl border border-hairline bg-[#161616]">
              <Image src={r.img} alt="" fill sizes="72px" className="object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{t(locale, r.name)}</span>
              <span className="block text-[11px] text-muted">{t(locale, "tour.p_rest")}</span>
            </span>
            <span
              dir="ltr"
              className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted"
            >
              {r.sets}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <LockedAction locale={locale} label="tour.p_swap" onLock={onLock} />
      </div>
    </div>
  );
}

/** The donut from MacroRing, at the size a tile needs. */
function MiniDonut({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#C0DA1B"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
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
          <bdi dir="ltr" className="tabular-nums text-muted">{value}g / {target}g</bdi>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min((value / target) * 100, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function FoodScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const meals: { slot: StringKey; items: StringKey; kcal: number }[] = [
    { slot: "tour.f_b", items: "tour.f_b_items", kcal: 520 },
    { slot: "tour.f_l", items: "tour.f_l_items", kcal: 780 },
    { slot: "tour.f_d", items: "tour.f_d_items", kcal: 640 },
    { slot: "tour.f_s", items: "tour.f_s_items", kcal: 210 },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.f_title")}</h1>
        <SampleTag locale={locale} />
      </div>

      <Card className="flex items-center gap-4">
        <span className="relative h-[92px] w-[92px] shrink-0">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#C0DA1B"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={2 * Math.PI * 70 * 0.38}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <bdi dir="ltr" className="font-display text-xl font-extrabold leading-none">1210</bdi>
            <span className="mt-0.5 text-[9px] text-muted">/ 1940 kcal</span>
          </span>
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <MacroBar label={t(locale, "diary.macro_protein")} value={96} target={148} color="#C0DA1B" />
          <MacroBar label={t(locale, "diary.macro_carbs")} value={132} target={210} color="#F5A623" />
          <MacroBar label={t(locale, "diary.macro_fat")} value={41} target={62} color="#B76CFF" />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {meals.map((m) => (
          <div
            key={m.slot}
            className="flex items-center justify-between rounded-2xl border border-hairline bg-surface p-3"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-bold">{t(locale, m.slot)}</span>
              <span className="block truncate text-[11px] text-muted">{t(locale, m.items)}</span>
            </span>
            <bdi dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-muted">
              {m.kcal} kcal
            </bdi>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <LockedAction locale={locale} label="tour.f_swap" onLock={onLock} />
      </div>
    </div>
  );
}

function AiScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const items: { key: StringKey; kcal: number }[] = [
    { key: "tour.ai_i1", kcal: 297 },
    { key: "tour.ai_i2", kcal: 195 },
    { key: "tour.ai_i3", kcal: 88 },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.ai_title")}</h1>
        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="h-3 w-3" />
          {t(locale, "tour.ai_sub")}
        </span>
      </div>

      {/* A viewfinder, not a stock photo of someone else's dinner. */}
      <div className="relative grid min-h-[150px] flex-1 place-items-center overflow-hidden rounded-3xl border border-hairline bg-gradient-to-br from-white/[0.06] to-transparent">
        <div className="glow-accent pointer-events-none absolute inset-0" />
        <Camera className="relative h-8 w-8 text-muted" aria-hidden />
        {[
          "start-4 top-4 border-s-2 border-t-2 rounded-ss-xl",
          "end-4 top-4 border-e-2 border-t-2 rounded-se-xl",
          "start-4 bottom-4 border-s-2 border-b-2 rounded-es-xl",
          "end-4 bottom-4 border-e-2 border-b-2 rounded-ee-xl",
        ].map((c) => (
          <span key={c} className={cn("absolute h-5 w-5 border-accent/70", c)} aria-hidden />
        ))}
      </div>

      <Card className="flex flex-col gap-2.5 p-3">
        {items.map(({ key, kcal }) => (
          <div key={key} className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15">
              <Check className="h-3 w-3 text-accent" aria-hidden />
            </span>
            <span className="flex-1 truncate text-[12px] font-semibold">{t(locale, key)}</span>
            <bdi dir="ltr" className="text-[12px] font-bold tabular-nums text-muted">{kcal} kcal</bdi>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-hairline pt-2.5">
          <span className="text-[12px] font-bold">{t(locale, "diary.totals")}</span>
          <bdi dir="ltr" className="font-display text-[15px] font-extrabold tabular-nums text-accent">
            580 kcal
          </bdi>
        </div>
      </Card>

      <LockedAction locale={locale} label="tour.ai_shoot" icon={Camera} onLock={onLock} />
    </div>
  );
}

function QaScreen({ locale, onLock }: { locale: Locale; onLock: () => void }) {
  const cards: { q: StringKey; a: StringKey }[] = [
    { q: "tour.qa_q1", a: "tour.qa_a1" },
    { q: "tour.qa_q2", a: "tour.qa_a2" },
    { q: "tour.qa_q3", a: "tour.qa_a3" },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-lg font-extrabold">{t(locale, "tour.qa_title")}</h1>
        <SampleTag locale={locale} />
      </div>

      {cards.map(({ q, a }) => (
        <Card key={q} className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15">
              <MessageCircleQuestion className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <p className="flex-1 text-[13px] font-bold leading-snug">{t(locale, q)}</p>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">{t(locale, a)}</p>
        </Card>
      ))}

      <div className="mt-auto">
        <LockedAction locale={locale} label="tour.qa_ask" onLock={onLock} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- the wall */

/**
 * The upgrade sheet — the moment the preview exists for.
 *
 * A sheet rather than a flat overlay, because that is what a paywall looks like
 * in an app people already trust, and because it leaves the screen behind it
 * visible: the reader can still see the thing they were reaching for while
 * being told what it costs.
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
            {t(locale, "tour.lock_title")}
          </h3>
          <p className="max-w-[30ch] text-[12.5px] leading-relaxed text-muted">
            {t(locale, "tour.lock_body")}
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
