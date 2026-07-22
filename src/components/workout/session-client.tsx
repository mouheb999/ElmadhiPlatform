"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Cloud,
  CloudOff,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExerciseIllustrationBanner, ExerciseMedia } from "@/components/workout/exercise-media";
import { illustrationFor } from "@/lib/exercise-illustrations";
import { cn } from "@/lib/utils";
import { pick, t, type Locale } from "@/lib/i18n";
import { finishSession } from "@/app/actions/sessions";
import { SESSION_ERR } from "@/lib/session-codes";
import {
  useSessionOutbox,
  clearSessionStorage,
  draftStorageKey,
  pruneStaleSessionKeys,
} from "@/lib/session-outbox";

export type SessionExercise = {
  rowId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string | null;
  /** exercises.equipment — drives which logging fields the card shows. */
  equipment: string;
  targetSets: number;
  repRange: string;
  restSeconds: number;
  lastWeightKg: number | null;
  lastReps: number | null;
  maxWeightKg: number | null;
  /** Rules-engine progression suggestion (V2): prefilled + explained. */
  suggestedWeightKg: number | null;
  suggestionReasonKey: "progress.reason_up" | "progress.reason_deload" | null;
  /** Admin CMS media: thumbnail + demo video (YouTube link). */
  thumbnailUrl: string | null;
  videoUrl: string | null;
  /** Per-exercise coaching cues from the split, shown only here (in-session). */
  notes: string | null;
};

/** A set already stored server-side (resume hydration). */
export type ServerSet = {
  userProgramExerciseId: string | null;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number;
  rir: number | null;
  nameEn: string;
  nameAr: string | null;
};

/** The user's open (in-progress) session for this day, if any. */
export type InitialSession = {
  sessionId: string;
  startedAt: string;
  skippedExerciseIds: string[];
  sets: ServerSet[];
  lastSetAt: string | null;
};

type SetEntry = {
  weight: string;
  reps: string;
  rir: string;
  done: boolean;
  /** Saved server-side (or optimistically queued) — irreversible. */
  locked: boolean;
};

/**
 * Unsent-field draft. Locked data lives server-side; this only carries what
 * the user typed but hasn't locked yet, plus UI toggles and the rest timer.
 */
type DraftV2 = {
  v: 2;
  savedAt: number;
  notes: string;
  entries: Record<string, { weight: string; reps: string; rir: string }[]>;
  showWeight: Record<string, boolean>;
  showRir: Record<string, boolean>;
  restEndsAt: number | null;
};

type Summary = {
  setCount: number;
  volumeKg: number;
  minutes: number;
  prNames: string[];
};

function emptyEntries(exercises: SessionExercise[]): Record<string, SetEntry[]> {
  const entries: Record<string, SetEntry[]> = {};
  for (const ex of exercises) {
    const prefill = ex.suggestedWeightKg ?? ex.lastWeightKg;
    entries[ex.rowId] = Array.from({ length: ex.targetSets }, () => ({
      weight: prefill !== null ? String(prefill) : "",
      reps: "",
      rir: "",
      done: false,
      locked: false,
    }));
  }
  return entries;
}

/** Lower bound of a "8-12" style rep range, used as a one-tap default. */
function defaultReps(repRange: string): string {
  const match = repRange.match(/\d+/);
  return match ? match[0] : "";
}

/** Bodyweight and band work has no load to log — the kg column starts hidden. */
function usesWeight(equipment: string): boolean {
  return equipment !== "bodyweight" && equipment !== "band";
}

/**
 * Live workout session. Every checked set saves to the server immediately
 * (through an offline-tolerant outbox) and locks — leaving the page, killing
 * the app or switching devices resumes exactly where the user left off.
 */
export function SessionClient({
  locale,
  dayId,
  dayName,
  exercises,
  initialSession,
}: {
  locale: Locale;
  dayId: string;
  dayName: string;
  exercises: SessionExercise[];
  initialSession: InitialSession | null;
}) {
  const router = useRouter();
  const rowIds = useMemo(() => new Set(exercises.map((ex) => ex.rowId)), [exercises]);

  // Sets stored server-side whose plan row no longer exists (program edited
  // mid-session). Shown read-only; the server still counts them on finish.
  const orphanSets = useMemo(
    () =>
      (initialSession?.sets ?? []).filter(
        (s) => !s.userProgramExerciseId || !rowIds.has(s.userProgramExerciseId),
      ),
    [initialSession, rowIds],
  );

  const [entries, setEntries] = useState<Record<string, SetEntry[]>>(() => {
    const base = emptyEntries(exercises);
    for (const set of initialSession?.sets ?? []) {
      const rowId = set.userProgramExerciseId;
      if (!rowId || !base[rowId]) continue;
      while (base[rowId].length < set.setNumber) {
        base[rowId].push({ weight: "", reps: "", rir: "", done: false, locked: false });
      }
      base[rowId][set.setNumber - 1] = {
        weight: set.weightKg !== null ? String(set.weightKg) : "",
        reps: String(set.reps),
        rir: set.rir !== null ? String(set.rir) : "",
        done: true,
        locked: true,
      };
    }
    return base;
  });

  // Per-exercise field visibility: the card only shows fields that matter for
  // that exercise (no kg column on push-ups), with opt-in toggles for the rest.
  const [showWeight, setShowWeight] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      exercises.map((ex) => [
        ex.rowId,
        usesWeight(ex.equipment) ||
          (initialSession?.sets ?? []).some(
            (s) => s.userProgramExerciseId === ex.rowId && s.weightKg !== null,
          ),
      ]),
    ),
  );
  const [showRir, setShowRir] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      exercises.map((ex) => [
        ex.rowId,
        (initialSession?.sets ?? []).some(
          (s) => s.userProgramExerciseId === ex.rowId && s.rir !== null,
        ),
      ]),
    ),
  );

  // Skips are irreversible: two-tap confirm, then locked (rowIds).
  const [skipped, setSkipped] = useState<string[]>(() =>
    exercises
      .filter((ex) => (initialSession?.skippedExerciseIds ?? []).includes(ex.exerciseId))
      .map((ex) => ex.rowId),
  );
  const [armedSkip, setArmedSkip] = useState<string | null>(null);
  const armedSkipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notes, setNotes] = useState("");
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [phase, setPhase] = useState<"logging" | "saving" | "done">("logging");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // ---- Outbox: irreversible writes, offline-tolerant ----
  const onBlocked = useCallback(() => {
    // Session closed/locked/superseded server-side — re-render from truth.
    clearSessionStorage(dayId);
    router.refresh();
  }, [dayId, router]);
  const onItemError = useCallback((message: string) => setError(message), []);
  const { pendingCount, syncState, enqueue, flushAll, getSessionId } = useSessionOutbox({
    dayId,
    initialSessionId: initialSession?.sessionId ?? null,
    onBlocked,
    onItemError,
  });

  // ---- Draft restore / persist (unlocked fields only) ----
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        pruneStaleSessionKeys(dayId);
        const raw = localStorage.getItem(draftStorageKey(dayId));
        if (raw) {
          const draft = JSON.parse(raw) as DraftV2;
          if (draft.v === 2) {
            setEntries((prev) => {
              const next = { ...prev };
              for (const [rowId, drafts] of Object.entries(draft.entries ?? {})) {
                if (!next[rowId]) continue;
                next[rowId] = next[rowId].map((entry, i) => {
                  const d = drafts[i];
                  if (!d || entry.locked) return entry; // server truth wins
                  return { ...entry, weight: d.weight, reps: d.reps, rir: d.rir };
                });
                // Draft may carry user-added sets beyond the plan.
                for (let i = next[rowId].length; i < drafts.length; i++) {
                  const d = drafts[i];
                  next[rowId].push({ ...d, done: false, locked: false });
                }
              }
              return next;
            });
            setShowWeight((prev) => ({ ...prev, ...(draft.showWeight ?? {}) }));
            setShowRir((prev) => ({ ...prev, ...(draft.showRir ?? {}) }));
            setNotes(draft.notes ?? "");
            if (draft.restEndsAt && draft.restEndsAt > Date.now()) {
              setNowMs(Date.now());
              setRestEndsAt(draft.restEndsAt);
            }
          } else {
            // Pre-live-session draft format — stale by definition.
            localStorage.removeItem(draftStorageKey(dayId));
          }
        } else if (initialSession?.lastSetAt) {
          // Cross-device resume: revive the rest timer from the newest set
          // (sets arrive ordered by created_at ascending).
          const lastSet = [...initialSession.sets]
            .reverse()
            .find((s) => s.userProgramExerciseId && rowIds.has(s.userProgramExerciseId));
          const ex = exercises.find((e) => e.rowId === lastSet?.userProgramExerciseId);
          const endsAt = Date.parse(initialSession.lastSetAt) + (ex?.restSeconds ?? 90) * 1000;
          if (endsAt > Date.now()) {
            setNowMs(Date.now());
            setRestEndsAt(endsAt);
          }
        }
      } catch {
        /* corrupt draft — start fresh */
      }
      hydrated.current = true;
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  useEffect(() => {
    if (!hydrated.current || phase !== "logging") return;
    const draft: DraftV2 = {
      v: 2,
      savedAt: Date.now(),
      notes,
      entries: Object.fromEntries(
        Object.entries(entries).map(([rowId, sets]) => [
          rowId,
          sets.map((s) => ({ weight: s.locked ? "" : s.weight, reps: s.locked ? "" : s.reps, rir: s.locked ? "" : s.rir })),
        ]),
      ),
      showWeight,
      showRir,
      restEndsAt,
    };
    try {
      localStorage.setItem(draftStorageKey(dayId), JSON.stringify(draft));
    } catch {
      /* storage full/blocked — session still works in memory */
    }
  }, [entries, notes, showWeight, showRir, restEndsAt, dayId, phase]);

  // ---- Rest timer (wall-clock based: survives reload and tab sleep) ----
  useEffect(() => {
    if (restEndsAt === null) return;
    const id = setInterval(() => {
      setNowMs(Date.now());
      if (restEndsAt - Date.now() <= 0) {
        if ("vibrate" in navigator) navigator.vibrate?.(200);
        setRestEndsAt(null);
      }
    }, 500);
    return () => clearInterval(id);
  }, [restEndsAt]);
  const restLeft =
    restEndsAt !== null ? Math.max(0, Math.ceil((restEndsAt - nowMs) / 1000)) : null;

  const updateSet = useCallback(
    (rowId: string, index: number, patch: Partial<SetEntry>) => {
      setEntries((prev) => ({
        ...prev,
        [rowId]: prev[rowId].map((s, i) => (i === index ? { ...s, ...patch } : s)),
      }));
    },
    [],
  );

  /**
   * The irreversible moment: fills sensible defaults, locks the set and
   * queues the server write. There is deliberately no way back.
   */
  function lockSet(ex: SessionExercise, index: number) {
    const entry = entries[ex.rowId][index];
    if (entry.locked || entry.done) return;

    let reps = entry.reps.trim();
    if (!reps) {
      const prev = entries[ex.rowId].slice(0, index).reverse().find((s) => s.reps.trim());
      reps = prev?.reps ?? (ex.lastReps !== null ? String(ex.lastReps) : defaultReps(ex.repRange));
    }
    const repsNum = parseInt(reps, 10);
    if (!Number.isFinite(repsNum) || repsNum <= 0) {
      setError(t(locale, "session.need_reps"));
      return;
    }

    let weight = entry.weight.trim();
    if (!weight) {
      const prev = entries[ex.rowId].slice(0, index).reverse().find((s) => s.weight.trim());
      if (prev) weight = prev.weight;
    }
    const weightNum = parseFloat(weight);
    const weightKg = Number.isFinite(weightNum) ? weightNum : null;
    const rirNum = parseInt(entry.rir, 10);
    const rir = Number.isFinite(rirNum) ? rirNum : null;

    setError(null);
    updateSet(ex.rowId, index, {
      weight: weightKg !== null ? String(weightKg) : entry.weight,
      reps: String(repsNum),
      done: true,
      locked: true,
    });
    setNowMs(Date.now());
    setRestEndsAt(Date.now() + ex.restSeconds * 1000);
    enqueue({
      kind: "set",
      rowId: ex.rowId,
      exerciseId: ex.exerciseId,
      setNumber: index + 1,
      weightKg,
      reps: repsNum,
      rir,
    });
  }

  function addSet(rowId: string) {
    setEntries((prev) => {
      const rows = prev[rowId];
      const last = rows[rows.length - 1];
      return {
        ...prev,
        [rowId]: [
          ...rows,
          { weight: last?.weight ?? "", reps: "", rir: "", done: false, locked: false },
        ],
      };
    });
  }

  /** First tap arms a confirm pill; second tap skips for good. */
  function requestSkip(ex: SessionExercise) {
    if (skipped.includes(ex.rowId)) return;
    if (armedSkip !== ex.rowId) {
      setArmedSkip(ex.rowId);
      if (armedSkipTimer.current) clearTimeout(armedSkipTimer.current);
      armedSkipTimer.current = setTimeout(() => setArmedSkip(null), 4000);
      return;
    }
    if (armedSkipTimer.current) clearTimeout(armedSkipTimer.current);
    setArmedSkip(null);
    setSkipped((prev) => [...prev, ex.rowId]);
    enqueue({ kind: "skip", exerciseId: ex.exerciseId });
  }

  const doneCount = useMemo(
    () =>
      exercises
        .filter((ex) => !skipped.includes(ex.rowId))
        .reduce((sum, ex) => sum + entries[ex.rowId].filter((s) => s.done).length, 0),
    [entries, skipped, exercises],
  );
  const targetCount = useMemo(
    () => exercises.filter((ex) => !skipped.includes(ex.rowId)).reduce((sum, ex) => sum + entries[ex.rowId].length, 0),
    [entries, skipped, exercises],
  );

  function isPr(ex: SessionExercise, entry: SetEntry): boolean {
    if (ex.maxWeightKg === null || !entry.done) return false;
    const w = parseFloat(entry.weight);
    return Number.isFinite(w) && w > ex.maxWeightKg;
  }

  async function finish() {
    setError(null);
    setPhase("saving");

    // Everything must be on the server before the session can close.
    const flushed = await flushAll();
    if (!flushed) {
      setPhase("logging");
      setError(t(locale, "session.sync_offline_finish"));
      return;
    }
    const sessionId = getSessionId();
    if (!sessionId) {
      // Nothing was ever logged (finish is disabled in that case anyway).
      setPhase("logging");
      return;
    }

    const prNames: string[] = [];
    const prIds: string[] = [];
    for (const ex of exercises) {
      if (skipped.includes(ex.rowId)) continue;
      if (entries[ex.rowId].some((entry) => isPr(ex, entry))) {
        prNames.push(pick(locale, ex.nameEn, ex.nameAr));
        prIds.push(ex.exerciseId);
      }
    }

    const result = await finishSession({ sessionId, notes: notes || null, prExerciseIds: prIds });
    if (!result.ok) {
      setPhase("logging");
      setError(
        result.error === SESSION_ERR.weekLocked
          ? t(locale, "session.week_locked")
          : result.error,
      );
      return;
    }

    clearSessionStorage(dayId);
    setSummary({ ...result.data, prNames });
    setPhase("done");
  }

  // ---- Completion screen ----
  if (phase === "done" && summary) {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15">
          <Trophy className="h-10 w-10 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{t(locale, "session.done_title")}</h1>
          <p className="mt-1 text-muted">{t(locale, "session.done_sub")}</p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-3 gap-3">
          <StatTile label={t(locale, "session.stat_sets")} value={String(summary.setCount)} />
          <StatTile label={t(locale, "session.stat_volume")} value={String(summary.volumeKg)} />
          <StatTile label={t(locale, "session.stat_minutes")} value={String(summary.minutes)} />
        </div>
        {summary.prNames.length > 0 && (
          <div className="w-full max-w-sm rounded-2xl border border-accent/40 bg-accent/10 p-4 text-start">
            <div className="flex items-center gap-2 font-bold text-accent">
              <Trophy className="h-4 w-4" />
              {t(locale, "session.pr_title")}
            </div>
            <ul className="mt-1 text-sm">
              {summary.prNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <Button asChild className="w-full max-w-sm">
          <Link href="/dashboard">{t(locale, "session.back_home")}</Link>
        </Button>
      </div>
    );
  }

  // ---- Logging screen ----
  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-hairline bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-lg font-extrabold">{dayName}</h1>
          <div className="flex shrink-0 items-center gap-3">
            <SyncBadge locale={locale} state={syncState} pending={pendingCount} />
            <span className="text-sm font-bold text-muted">
              {doneCount}/{targetCount} {t(locale, "session.progress_sets")}
            </span>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${targetCount ? Math.round((doneCount / targetCount) * 100) : 0}%` }}
          />
        </div>
      </div>

      {orphanSets.length > 0 && <OrphanSetsCard locale={locale} sets={orphanSets} />}

      {exercises.map((ex) => {
        const isSkipped = skipped.includes(ex.rowId);
        const illustration = illustrationFor(ex.nameEn);
        const weightVisible = showWeight[ex.rowId] ?? true;
        const rirVisible = showRir[ex.rowId] ?? false;
        const gridCols = `2rem ${weightVisible ? "1fr " : ""}1fr ${rirVisible ? "1fr " : ""}2.75rem`;
        return (
          <div
            key={ex.rowId}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4",
              isSkipped && "opacity-50",
            )}
          >
            {illustration && !isSkipped && (
              <ExerciseIllustrationBanner
                locale={locale}
                name={pick(locale, ex.nameEn, ex.nameAr)}
                illustrationUrl={illustration}
                videoUrl={ex.videoUrl}
              />
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {!illustration && (
                  <ExerciseMedia
                    locale={locale}
                    name={pick(locale, ex.nameEn, ex.nameAr)}
                    thumbnailUrl={ex.thumbnailUrl}
                    videoUrl={ex.videoUrl}
                  />
                )}
                <div className="min-w-0">
                  <div className="font-bold">{pick(locale, ex.nameEn, ex.nameAr)}</div>
                <div className="text-xs text-muted">
                  {ex.targetSets} × {ex.repRange} · {ex.restSeconds}s {t(locale, "session.rest")}
                  {ex.lastWeightKg !== null && (
                    <>
                      {" · "}
                      {t(locale, "session.last_time")}: {ex.lastWeightKg} {t(locale, "session.kg")}
                      {ex.lastReps !== null ? ` × ${ex.lastReps}` : ""}
                    </>
                  )}
                </div>
                {ex.suggestedWeightKg !== null && ex.suggestionReasonKey && (
                  <div className="mt-1 flex items-start gap-1 text-xs font-semibold text-accent">
                    {ex.suggestionReasonKey === "progress.reason_up" ? (
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {t(locale, "progress.suggested")}: {ex.suggestedWeightKg} {t(locale, "session.kg")} —{" "}
                      {t(locale, ex.suggestionReasonKey)}
                    </span>
                  </div>
                )}
                {ex.notes && !isSkipped && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {ex.notes.split("|").map((cue, i) => {
                      const text = cue.trim();
                      return text ? (
                        <li key={i} className="flex items-start gap-1.5 text-xs font-medium text-emerald-400">
                          <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          <span>{text}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
                </div>
              </div>
              {isSkipped ? (
                <span className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-bold text-muted">
                  {t(locale, "session.skipped_label")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => requestSkip(ex)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    armedSkip === ex.rowId
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : "border-hairline text-muted hover:text-ink",
                  )}
                >
                  {armedSkip === ex.rowId
                    ? t(locale, "session.skip_confirm")
                    : t(locale, "session.skip_exercise")}
                </button>
              )}
            </div>

            {!isSkipped && (
              <>
                <div
                  className="grid items-center gap-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <span>#</span>
                  {weightVisible && <span>{t(locale, "session.kg")}</span>}
                  <span>{t(locale, "session.reps")}</span>
                  {rirVisible && <span>{t(locale, "session.rir")}</span>}
                  <span />
                </div>
                {entries[ex.rowId].map((entry, i) => (
                  <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: gridCols }}>
                    <span className="text-center text-sm font-bold text-muted">{i + 1}</span>
                    {weightVisible && (
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={entry.weight}
                        disabled={entry.locked}
                        onChange={(e) => updateSet(ex.rowId, i, { weight: e.target.value })}
                        className={cn("h-11 px-2 text-center text-sm", entry.locked && "opacity-60")}
                      />
                    )}
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={entry.reps}
                      disabled={entry.locked}
                      onChange={(e) => updateSet(ex.rowId, i, { reps: e.target.value })}
                      className={cn("h-11 px-2 text-center text-sm", entry.locked && "opacity-60")}
                    />
                    {rirVisible && (
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={entry.rir}
                        disabled={entry.locked}
                        onChange={(e) => updateSet(ex.rowId, i, { rir: e.target.value })}
                        className={cn("h-11 px-2 text-center text-sm", entry.locked && "opacity-60")}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => lockSet(ex, i)}
                      aria-label={`Set ${i + 1} ${entry.locked ? t(locale, "session.locked_set") : "done"}`}
                      aria-disabled={entry.locked}
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-xl border transition-colors",
                        entry.done
                          ? "border-accent bg-accent text-bg"
                          : "border-hairline text-muted hover:text-ink",
                        entry.locked && "cursor-default",
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    {isPr(ex, entry) && (
                      <span className="col-span-full -mt-1 flex items-center justify-end gap-1 text-end text-xs font-bold text-accent">
                        <Trophy className="h-3.5 w-3.5" /> {t(locale, "session.pr_badge")}
                      </span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => addSet(ex.rowId)}
                    className="text-sm font-bold text-accent hover:underline"
                  >
                    + {t(locale, "session.add_set")}
                  </button>
                  <div className="flex gap-1.5">
                    {!usesWeight(ex.equipment) && (
                      <FieldToggle
                        label={t(locale, "session.kg")}
                        active={weightVisible}
                        onClick={() => setShowWeight((prev) => ({ ...prev, [ex.rowId]: !weightVisible }))}
                      />
                    )}
                    <FieldToggle
                      label={t(locale, "session.rir")}
                      active={rirVisible}
                      onClick={() => setShowRir((prev) => ({ ...prev, [ex.rowId]: !rirVisible }))}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-muted" htmlFor="session-notes">
          {t(locale, "session.notes_label")}
        </label>
        <Input
          id="session-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{t(locale, "session.save_error")}</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
        </div>
      )}

      <Button onClick={finish} disabled={phase === "saving" || (doneCount === 0 && orphanSets.length === 0 && skipped.length === 0)}>
        {phase === "saving" ? t(locale, "session.saving") : t(locale, "session.finish")}
      </Button>

      {restLeft !== null && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-accent/40 bg-surface/95 px-5 py-2.5 shadow-lg backdrop-blur">
            <Timer className="h-5 w-5 text-accent" />
            <span className="min-w-12 text-center text-lg font-extrabold tabular-nums">
              {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
            </span>
            <span className="text-sm text-muted">{t(locale, "session.resting")}</span>
            <button
              type="button"
              onClick={() => setRestEndsAt(null)}
              aria-label={t(locale, "session.skip_rest")}
              className="grid h-8 w-8 place-items-center rounded-full border border-hairline text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Live save status in the sticky header. */
function SyncBadge({ locale, state, pending }: { locale: Locale; state: SyncState; pending: number }) {
  const label =
    state === "offline"
      ? t(locale, "session.sync_offline")
      : state === "saving" || pending > 0
        ? t(locale, "session.sync_saving")
        : t(locale, "session.sync_saved");
  const Icon = state === "offline" ? CloudOff : state === "saving" || pending > 0 ? RefreshCw : Cloud;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-bold",
        state === "offline" ? "text-amber-400" : "text-muted",
      )}
      title={label}
      aria-label={label}
    >
      <Icon className={cn("h-3.5 w-3.5", (state === "saving" || pending > 0) && state !== "offline" && "animate-spin")} />
    </span>
  );
}

type SyncState = "saved" | "saving" | "offline";

/** Sets whose plan row was removed after they were logged — still counted. */
function OrphanSetsCard({ locale, sets }: { locale: Locale; sets: ServerSet[] }) {
  const grouped = new Map<string, { name: string; count: number }>();
  for (const s of sets) {
    const g = grouped.get(s.exerciseId) ?? { name: pick(locale, s.nameEn, s.nameAr), count: 0 };
    g.count += 1;
    grouped.set(s.exerciseId, g);
  }
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-muted">
      <div className="font-bold text-ink">{t(locale, "session.already_logged")}</div>
      <ul className="mt-1">
        {[...grouped.values()].map((g) => (
          <li key={g.name}>
            {g.name} — {g.count} {t(locale, "session.progress_sets")}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small pill that shows/hides an optional logging column for one exercise. */
function FieldToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
        active ? "border-accent/60 bg-accent/10 text-accent" : "border-hairline text-muted hover:text-ink",
      )}
    >
      {active ? label : `+ ${label}`}
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
