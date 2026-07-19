"use client";

/**
 * Offline-tolerant write queue for the live workout session.
 *
 * Every irreversible action (set logged, exercise skipped) is enqueued here,
 * persisted to localStorage, and flushed FIFO to the server actions. The
 * server is idempotent per (session, plan row, set number), so retries and
 * cross-device double-taps are safe. The session row itself is created
 * lazily by the first flush — visiting the page never writes to the DB.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { startSession, logSet, skipExercise } from "@/app/actions/sessions";
import { SESSION_ERR, type SessionErrCode } from "@/lib/session-codes";

export type OutboxItem =
  | {
      kind: "set";
      rowId: string; // user_program_exercise_id
      exerciseId: string;
      setNumber: number;
      weightKg: number | null;
      reps: number;
      rir: number | null;
    }
  | { kind: "skip"; exerciseId: string };

type OutboxState = { v: 2; sessionId: string | null; items: OutboxItem[] };

export type SyncState = "saved" | "saving" | "offline";

export function outboxStorageKey(dayId: string): string {
  return `elmadhi.session.outbox.${dayId}`;
}

export function draftStorageKey(dayId: string): string {
  return `elmadhi.session.${dayId}`;
}

/** Removes both live-session keys for a day (finish, locked render). */
export function clearSessionStorage(dayId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(dayId));
    localStorage.removeItem(outboxStorageKey(dayId));
  } catch {
    /* storage unavailable */
  }
}

function loadOutbox(dayId: string): OutboxState {
  try {
    const raw = localStorage.getItem(outboxStorageKey(dayId));
    if (raw) {
      const parsed = JSON.parse(raw) as OutboxState;
      if (parsed.v === 2 && Array.isArray(parsed.items)) return parsed;
    }
  } catch {
    /* corrupt — start clean */
  }
  return { v: 2, sessionId: null, items: [] };
}

function saveOutbox(dayId: string, state: OutboxState): void {
  try {
    localStorage.setItem(outboxStorageKey(dayId), JSON.stringify(state));
  } catch {
    /* storage full/blocked — queue keeps working in memory */
  }
}

const BLOCKED_CODES: string[] = [
  SESSION_ERR.weekLocked,
  SESSION_ERR.otherInProgress,
  SESSION_ERR.notOpen,
];

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

/**
 * The queue engine. Single-flight flush with capped backoff, re-kicked when
 * the connection or the tab comes back.
 */
export function useSessionOutbox(opts: {
  dayId: string;
  /** Server-known open session for this day (resume), if any. */
  initialSessionId: string | null;
  /**
   * The session was closed or superseded server-side (finished on another
   * device, weekly lock, other day in progress). UI should refresh.
   */
  onBlocked: (code: SessionErrCode) => void;
  /** A non-retryable rejection (validation) — item was dropped. */
  onItemError: (message: string) => void;
}) {
  const { dayId, initialSessionId, onBlocked, onItemError } = opts;

  const stateRef = useRef<OutboxState | null>(null);
  const flushingRef = useRef(false);
  const backoffRef = useRef(BACKOFF_START_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("saved");

  // Stable refs for the callbacks so the flush loop never goes stale.
  const onBlockedRef = useRef(onBlocked);
  const onItemErrorRef = useRef(onItemError);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
    onItemErrorRef.current = onItemError;
  });

  // Lets the retry timer re-enter flush without a self-reference.
  const flushRef = useRef<() => Promise<boolean>>(async () => false);

  const getState = useCallback((): OutboxState => {
    if (!stateRef.current) {
      stateRef.current = loadOutbox(dayId);
      // The server's view of the open session always wins over a stale key.
      if (initialSessionId) stateRef.current.sessionId = initialSessionId;
    }
    return stateRef.current;
  }, [dayId, initialSessionId]);

  const persist = useCallback(() => {
    const state = getState();
    saveOutbox(dayId, state);
    setPendingCount(state.items.length);
  }, [dayId, getState]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) return false;
    flushingRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    const state = getState();
    try {
      while (state.items.length > 0) {
        setSyncState("saving");

        // Lazy session open — the first locked action creates the row.
        if (!state.sessionId) {
          const started = await startSession(dayId);
          if (!started.ok) {
            if (BLOCKED_CODES.includes(started.error)) {
              state.items = [];
              persist();
              onBlockedRef.current(started.error as SessionErrCode);
              setSyncState("saved");
              return false;
            }
            throw new Error(started.error);
          }
          state.sessionId = started.data.sessionId;
          setSessionId(started.data.sessionId);
          persist();
        }

        const item = state.items[0];
        const result =
          item.kind === "set"
            ? await logSet({
                sessionId: state.sessionId,
                exerciseId: item.exerciseId,
                userProgramExerciseId: item.rowId,
                setNumber: item.setNumber,
                weightKg: item.weightKg,
                reps: item.reps,
                rir: item.rir,
              })
            : await skipExercise(state.sessionId, item.exerciseId);

        if (!result.ok) {
          if (result.error === SESSION_ERR.notOpen) {
            // Session finished/discarded elsewhere; the queue is stale.
            state.items = [];
            state.sessionId = null;
            persist();
            onBlockedRef.current(SESSION_ERR.notOpen);
            setSyncState("saved");
            return false;
          }
          // Validation rejection — retrying will never succeed; drop it.
          state.items.shift();
          persist();
          onItemErrorRef.current(result.error);
          continue;
        }

        state.items.shift();
        persist();
        backoffRef.current = BACKOFF_START_MS;
      }
      setSyncState("saved");
      return true;
    } catch {
      // Network failure (server action fetch threw). Retry with backoff.
      setSyncState("offline");
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, BACKOFF_MAX_MS);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        flushingRef.current = false;
        void flushRef.current();
      }, delay);
      return false;
    } finally {
      // The retry path re-enters flush itself; only release when not queued.
      if (!retryTimerRef.current) flushingRef.current = false;
    }
  }, [dayId, getState, persist]);

  const enqueue = useCallback(
    (item: OutboxItem) => {
      const state = getState();
      state.items.push(item);
      persist();
      void flush();
    },
    [getState, persist, flush],
  );

  /** Drains the queue now (used by finish). True when fully flushed. */
  const flushAll = useCallback(async (): Promise<boolean> => {
    // A parked retry isn't "in flight" — cancel it so we can run immediately.
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      flushingRef.current = false;
    }
    // Wait out a genuinely in-flight flush, then run one ourselves.
    for (let i = 0; i < 200 && flushingRef.current; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (getState().items.length === 0) return true;
    backoffRef.current = BACKOFF_START_MS;
    const done = await flush();
    return done && getState().items.length === 0;
  }, [flush, getState]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Boot: adopt persisted queue (e.g. logged offline, then reloaded).
  useEffect(() => {
    const state = getState();
    setPendingCount(state.items.length);
    if (state.sessionId) setSessionId(state.sessionId);
    if (state.items.length > 0) void flush();

    const kick = () => {
      if (getState().items.length > 0) void flush();
    };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick);
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flush, getState]);

  /** Current session id straight from the queue (no state-lag), for finish(). */
  const getSessionId = useCallback(
    (): string | null => getState().sessionId,
    [getState],
  );

  return { sessionId, pendingCount, syncState, enqueue, flushAll, getSessionId };
}

/**
 * Best-effort cleanup of session keys for other days that have no pending
 * writes and haven't been touched in 7+ days.
 */
export function pruneStaleSessionKeys(activeDayId: string): void {
  try {
    const now = Date.now();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("elmadhi.session.") && !key.includes(activeDayId)) keys.push(key);
    }
    for (const key of keys) {
      if (key.startsWith("elmadhi.session.outbox.")) continue; // pending writes stay
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { savedAt?: number };
        // v2 drafts stamp savedAt; older formats have none and get pruned.
        if (!parsed.savedAt || now - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
          const dayId = key.replace("elmadhi.session.", "");
          const outboxRaw = localStorage.getItem(outboxStorageKey(dayId));
          const outbox = outboxRaw ? (JSON.parse(outboxRaw) as OutboxState) : null;
          if (!outbox || outbox.items.length === 0) localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable */
  }
}
