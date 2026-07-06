"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { pick, t, type Locale } from "@/lib/i18n";
import { completeSession, type SessionSetInput } from "@/app/actions/sessions";

export type SessionExercise = {
  rowId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string | null;
  targetSets: number;
  repRange: string;
  restSeconds: number;
  lastWeightKg: number | null;
  lastReps: number | null;
  maxWeightKg: number | null;
};

type SetEntry = { weight: string; reps: string; rir: string; done: boolean };

type Draft = {
  date: string;
  startedAt: string;
  notes: string;
  skipped: string[];
  entries: Record<string, SetEntry[]>;
};

type Summary = {
  setCount: number;
  volumeKg: number;
  minutes: number;
  prNames: string[];
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function draftStorageKey(dayId: string): string {
  return `elmadhi.session.${dayId}`;
}

function emptyEntries(exercises: SessionExercise[]): Record<string, SetEntry[]> {
  const entries: Record<string, SetEntry[]> = {};
  for (const ex of exercises) {
    entries[ex.rowId] = Array.from({ length: ex.targetSets }, () => ({
      weight: ex.lastWeightKg !== null ? String(ex.lastWeightKg) : "",
      reps: "",
      rir: "",
      done: false,
    }));
  }
  return entries;
}

/** Lower bound of a "8-12" style rep range, used as a one-tap default. */
function defaultReps(repRange: string): string {
  const match = repRange.match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Live workout session. All state lives on the phone (localStorage draft,
 * survives refreshes and dead gym Wi-Fi); one server write on finish.
 */
export function SessionClient({
  locale,
  dayId,
  dayName,
  exercises,
  completedToday,
}: {
  locale: Locale;
  dayId: string;
  dayName: string;
  exercises: SessionExercise[];
  completedToday: boolean;
}) {
  const [entries, setEntries] = useState<Record<string, SetEntry[]>>(() => emptyEntries(exercises));
  const [skipped, setSkipped] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<"logging" | "saving" | "done">("logging");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // ---- Draft restore / persist (local-first) ----
  // Restore runs in a macrotask: localStorage only exists client-side, and
  // deferring the setState avoids hydration mismatch + cascading renders.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(draftStorageKey(dayId));
        if (raw) {
          const draft = JSON.parse(raw) as Draft;
          if (draft.date === todayKey()) {
            setEntries((prev) => ({ ...prev, ...draft.entries }));
            setSkipped(draft.skipped ?? []);
            setNotes(draft.notes ?? "");
            if (draft.startedAt) setStartedAt(draft.startedAt);
          } else {
            localStorage.removeItem(draftStorageKey(dayId));
          }
        }
      } catch {
        /* corrupt draft — start fresh */
      }
      hydrated.current = true;
    }, 0);
    return () => clearTimeout(id);
  }, [dayId]);

  useEffect(() => {
    if (!hydrated.current || phase !== "logging") return;
    const draft: Draft = { date: todayKey(), startedAt, notes, skipped, entries };
    try {
      localStorage.setItem(draftStorageKey(dayId), JSON.stringify(draft));
    } catch {
      /* storage full/blocked — session still works in memory */
    }
  }, [entries, skipped, notes, startedAt, dayId, phase]);

  // ---- Rest timer ----
  useEffect(() => {
    if (restLeft === null) return;
    const id = setTimeout(() => {
      if (restLeft <= 1) {
        if ("vibrate" in navigator) navigator.vibrate?.(200);
        setRestLeft(null);
      } else {
        setRestLeft(restLeft - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [restLeft]);

  const updateSet = useCallback(
    (rowId: string, index: number, patch: Partial<SetEntry>) => {
      setEntries((prev) => ({
        ...prev,
        [rowId]: prev[rowId].map((s, i) => (i === index ? { ...s, ...patch } : s)),
      }));
    },
    [],
  );

  function toggleDone(ex: SessionExercise, index: number) {
    const entry = entries[ex.rowId][index];
    if (!entry.done) {
      // One-tap ergonomics: fill sensible defaults instead of blocking.
      const patch: Partial<SetEntry> = { done: true };
      if (!entry.reps.trim()) {
        const prev = entries[ex.rowId].slice(0, index).reverse().find((s) => s.reps.trim());
        patch.reps = prev?.reps ?? (ex.lastReps !== null ? String(ex.lastReps) : defaultReps(ex.repRange));
      }
      if (!entry.weight.trim()) {
        const prev = entries[ex.rowId].slice(0, index).reverse().find((s) => s.weight.trim());
        if (prev) patch.weight = prev.weight;
      }
      updateSet(ex.rowId, index, patch);
      setRestLeft(ex.restSeconds);
    } else {
      updateSet(ex.rowId, index, { done: false });
    }
  }

  function addSet(rowId: string) {
    setEntries((prev) => {
      const rows = prev[rowId];
      const last = rows[rows.length - 1];
      return {
        ...prev,
        [rowId]: [...rows, { weight: last?.weight ?? "", reps: "", rir: "", done: false }],
      };
    });
  }

  function toggleSkip(rowId: string) {
    setSkipped((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
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
    const sets: SessionSetInput[] = [];
    const prNames: string[] = [];
    const prIds: string[] = [];
    let volumeKg = 0;

    for (const ex of exercises) {
      if (skipped.includes(ex.rowId)) continue;
      let setNumber = 0;
      let hitPr = false;
      for (const entry of entries[ex.rowId]) {
        if (!entry.done) continue;
        const reps = parseInt(entry.reps, 10);
        if (!Number.isFinite(reps) || reps <= 0) continue;
        setNumber += 1;
        const weight = parseFloat(entry.weight);
        const rir = parseInt(entry.rir, 10);
        const weightKg = Number.isFinite(weight) ? weight : null;
        if (weightKg !== null) volumeKg += weightKg * reps;
        if (isPr(ex, entry)) hitPr = true;
        sets.push({
          exerciseId: ex.exerciseId,
          userProgramExerciseId: ex.rowId,
          setNumber,
          weightKg,
          reps,
          rir: Number.isFinite(rir) ? rir : null,
        });
      }
      if (hitPr) {
        prNames.push(pick(locale, ex.nameEn, ex.nameAr));
        prIds.push(ex.exerciseId);
      }
    }

    const skippedExerciseIds = exercises
      .filter((ex) => skipped.includes(ex.rowId))
      .map((ex) => ex.exerciseId);

    setPhase("saving");
    const result = await completeSession({
      userProgramDayId: dayId,
      startedAt,
      notes: notes || null,
      skippedExerciseIds,
      sets,
      prExerciseIds: prIds,
    });

    if (!result.ok) {
      setPhase("logging");
      setError(result.error);
      return;
    }

    try {
      localStorage.removeItem(draftStorageKey(dayId));
    } catch {
      /* ignore */
    }
    setSummary({
      setCount: sets.length,
      volumeKg: Math.round(volumeKg),
      minutes: Math.max(1, Math.round((Date.now() - Date.parse(startedAt)) / 60000)),
      prNames,
    });
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
            <div className="font-bold text-accent">{t(locale, "session.pr_title")}</div>
            <ul className="mt-1 text-sm">
              {summary.prNames.map((name) => (
                <li key={name}>🏆 {name}</li>
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold">{dayName}</h1>
          <span className="text-sm font-bold text-muted">
            {doneCount}/{targetCount} {t(locale, "session.progress_sets")}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${targetCount ? Math.round((doneCount / targetCount) * 100) : 0}%` }}
          />
        </div>
      </div>

      {completedToday && (
        <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          {t(locale, "session.already_done")}
        </p>
      )}

      {exercises.map((ex) => {
        const isSkipped = skipped.includes(ex.rowId);
        return (
          <div
            key={ex.rowId}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4",
              isSkipped && "opacity-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
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
              </div>
              <button
                type="button"
                onClick={() => toggleSkip(ex.rowId)}
                className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-bold text-muted hover:text-ink"
              >
                {isSkipped ? t(locale, "session.unskip_exercise") : t(locale, "session.skip_exercise")}
              </button>
            </div>

            {!isSkipped && (
              <>
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
                  <span>#</span>
                  <span>{t(locale, "session.kg")}</span>
                  <span>{t(locale, "session.reps")}</span>
                  <span>{t(locale, "session.rir")}</span>
                  <span />
                </div>
                {entries[ex.rowId].map((entry, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2">
                    <span className="text-center text-sm font-bold text-muted">{i + 1}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={entry.weight}
                      onChange={(e) => updateSet(ex.rowId, i, { weight: e.target.value })}
                      className="h-11 px-2 text-center text-sm"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={entry.reps}
                      onChange={(e) => updateSet(ex.rowId, i, { reps: e.target.value })}
                      className="h-11 px-2 text-center text-sm"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={entry.rir}
                      onChange={(e) => updateSet(ex.rowId, i, { rir: e.target.value })}
                      className="h-11 px-2 text-center text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleDone(ex, i)}
                      aria-label={`Set ${i + 1} done`}
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-xl border transition-colors",
                        entry.done
                          ? "border-accent bg-accent text-bg"
                          : "border-hairline text-muted hover:text-ink",
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    {isPr(ex, entry) && (
                      <span className="col-span-5 -mt-1 text-end text-xs font-bold text-accent">
                        🏆 {t(locale, "session.pr_badge")}
                      </span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSet(ex.rowId)}
                  className="self-start text-sm font-bold text-accent hover:underline"
                >
                  + {t(locale, "session.add_set")}
                </button>
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

      <Button onClick={finish} disabled={phase === "saving" || doneCount === 0}>
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
              onClick={() => setRestLeft(null)}
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
