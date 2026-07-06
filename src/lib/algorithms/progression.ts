/**
 * Per-exercise double-progression rules (V2 slice 1). Pure: recent session
 * history for one exercise in, a suggested next weight + reason key out.
 *
 * - Go up (+2.5 kg) when the last session hit the top of the rep range on
 *   every working set with reps in reserve (RIR >= 2 wherever it was logged).
 * - Deload (-10%) when three consecutive sessions sat at the same weight,
 *   never beat the range, and the last one was near failure (RIR <= 1).
 * - Otherwise: no suggestion — the prefill stays at last session's weight.
 */

export type HistorySet = {
  weightKg: number | null;
  reps: number;
  rir: number | null;
};

export type ProgressionSuggestion = {
  weightKg: number;
  reasonKey: "progress.reason_up" | "progress.reason_deload";
};

const INCREMENT_KG = 2.5;

/** Upper bound of an "8-12" style range; single numbers count as the top. */
function topOfRange(repRange: string): number | null {
  const numbers = repRange.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return parseInt(numbers[numbers.length - 1], 10);
}

function roundToIncrement(weight: number): number {
  return Math.round((weight / INCREMENT_KG) * 2) / 2 * INCREMENT_KG;
}

function topWeight(session: HistorySet[]): number | null {
  const weights = session.map((s) => s.weightKg).filter((w): w is number => w !== null);
  return weights.length ? Math.max(...weights) : null;
}

/** Did this session beat the top of the rep range on all weighted sets, fresh? */
function beatRange(session: HistorySet[], topReps: number): boolean {
  const working = session.filter((s) => s.weightKg !== null);
  if (working.length === 0) return false;
  const repsOk = working.every((s) => s.reps >= topReps);
  const rirOk = working.every((s) => s.rir === null || s.rir >= 2);
  return repsOk && rirOk;
}

/**
 * @param sessions this exercise's sets grouped per session, most recent
 *                 first, up to 3 sessions.
 */
export function suggestNextWeight(
  repRange: string,
  sessions: HistorySet[][],
): ProgressionSuggestion | null {
  const topReps = topOfRange(repRange);
  if (topReps === null || sessions.length === 0) return null;

  const last = sessions[0];
  const lastWeight = topWeight(last);
  if (lastWeight === null) return null;

  if (beatRange(last, topReps)) {
    return { weightKg: lastWeight + INCREMENT_KG, reasonKey: "progress.reason_up" };
  }

  if (sessions.length >= 3) {
    const stuck = sessions
      .slice(0, 3)
      .every((s) => topWeight(s) === lastWeight && !beatRange(s, topReps));
    const nearFailure = last.some((s) => s.rir !== null && s.rir <= 1);
    if (stuck && nearFailure) {
      const deloaded = Math.max(INCREMENT_KG, roundToIncrement(lastWeight * 0.9));
      if (deloaded < lastWeight) {
        return { weightKg: deloaded, reasonKey: "progress.reason_deload" };
      }
    }
  }

  return null;
}
