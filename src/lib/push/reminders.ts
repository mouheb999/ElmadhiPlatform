/**
 * Which reminder, if any, a member should get today.
 *
 * One function, no I/O, so the whole policy can be read in one place and
 * tested without a database or a push service.
 *
 * The rules, in priority order — the first that applies is the one sent, and
 * nobody gets more than one a day:
 *
 *   1. `trial_last_day`  the free days end within a day and nothing is paid.
 *                        The most useful thing to know before a door closes
 *                        is that it is about to.
 *   2. `trial_ended`     the free days are over and nothing is paid. Sent the
 *                        day after and once more on the fourth day, then never
 *                        again: somebody who has read it twice has decided.
 *   3. `come_back`       they can use the app and have logged nothing for two
 *                        days or more. Sent every other day at most, and it
 *                        stops after two weeks of silence — past that it is
 *                        not a reminder, it is spam.
 *   4. `log_today`       they are active and have simply not logged today.
 *
 * Nothing is sent to an account that is locked out except the two trial
 * messages: reminding someone to use an app they cannot open is the fastest
 * way to get notifications switched off.
 *
 * And never the same reminder two days running, whatever the rules say — a
 * notification that repeats itself daily is the one people silence.
 */
export type ReminderKind = "trial_last_day" | "trial_ended" | "come_back" | "log_today";

export type ReminderState = {
  /** A confirmed, unexpired subscription. */
  paid: boolean;
  /** ISO timestamp of `profiles.free_access_until`, or null. */
  freeAccessUntil: string | null;
  /** ISO timestamp of the last thing they logged — a meal, a session, a check-in. */
  lastActivityAt: string | null;
  /** Whether any of those happened on today's calendar day in Tunis. */
  loggedToday: boolean;
  /** When this browser was last sent anything, and what. */
  lastSentAt: string | null;
  lastKind: string | null;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Leave at least this long between two reminders to one browser. */
export const MIN_GAP_HOURS = 20;

/** Past this much silence, stop asking them to come back. */
export const GIVE_UP_AFTER_DAYS = 14;

export function pickReminder(state: ReminderState, now: Date = new Date()): ReminderKind | null {
  const nowMs = now.getTime();

  if (state.lastSentAt && nowMs - Date.parse(state.lastSentAt) < MIN_GAP_HOURS * HOUR) {
    return null;
  }

  const kind = choose(state, nowMs);
  if (!kind) return null;
  // The same message two runs in a row is dropped, except the trial warning,
  // which can only ever be true on one day anyway.
  if (kind === state.lastKind && kind !== "trial_last_day") {
    // `come_back` and `trial_ended` are allowed to repeat, but not back to back.
    const sinceLast = state.lastSentAt ? nowMs - Date.parse(state.lastSentAt) : Infinity;
    if (sinceLast < 2 * DAY - 4 * HOUR) return null;
  }
  return kind;
}

function choose(state: ReminderState, nowMs: number): ReminderKind | null {
  const freeUntil = state.freeAccessUntil ? Date.parse(state.freeAccessUntil) : null;
  const onFreeDays = freeUntil !== null && freeUntil > nowMs;
  const hasAccess = state.paid || onFreeDays;

  if (!state.paid && freeUntil !== null) {
    if (onFreeDays && freeUntil - nowMs <= DAY) return "trial_last_day";
    if (!onFreeDays) {
      const daysOver = Math.floor((nowMs - freeUntil) / DAY);
      // The day after it ended, and once more on day four.
      return daysOver <= 1 || daysOver === 3 || daysOver === 4 ? "trial_ended" : null;
    }
  }

  if (!hasAccess) return null;

  const idleMs = state.lastActivityAt ? nowMs - Date.parse(state.lastActivityAt) : null;
  if (idleMs !== null && idleMs >= 2 * DAY) {
    return idleMs <= GIVE_UP_AFTER_DAYS * DAY ? "come_back" : null;
  }

  // Active recently, or brand new with nothing logged yet: one nudge a day.
  return state.loggedToday ? null : "log_today";
}

/** What each reminder says, and where tapping it lands. */
export const REMINDER_COPY: Record<
  ReminderKind,
  { url: string; en: { title: string; body: string }; tn: { title: string; body: string } }
> = {
  trial_last_day: {
    url: "/checkout",
    en: {
      title: "Last free day",
      body: "Your free days end tomorrow. Start your 90-day challenge and keep everything you logged.",
    },
    tn: {
      title: "آخر يوم مجاني",
      body: "أيامك المجانية تنتهي غداً. ابدأ تحدّي 90 يوماً واحتفظ بكل ما سجّلته.",
    },
  },
  trial_ended: {
    url: "/checkout",
    en: {
      title: "Your plan is waiting",
      body: "Your free days are over, and your plan and progress are saved. Pick up where you stopped.",
    },
    tn: {
      title: "برنامجك في انتظارك",
      body: "انتهت أيامك المجانية، وبرنامجك وتقدّمك محفوظان. واصل من حيث توقّفت.",
    },
  },
  come_back: {
    url: "/dashboard",
    en: {
      title: "Two days without a log",
      body: "One meal or one weigh-in is enough to keep your plan on track today.",
    },
    tn: {
      title: "يومان بدون تسجيل",
      body: "وجبة واحدة أو وزن واحد يكفي لتبقى خطّتك على المسار اليوم.",
    },
  },
  log_today: {
    url: "/dashboard",
    en: {
      title: "Nothing logged today",
      body: "Snap your dinner or log your weight. It takes ten seconds.",
    },
    tn: {
      title: "لم تسجّل شيئاً اليوم",
      body: "صوّر عشاءك أو سجّل وزنك. عشر ثوانٍ فقط.",
    },
  },
};

/** The notification a member sends themselves from Settings. */
export const TEST_COPY = {
  url: "/dashboard",
  en: { title: "Reminders are on", body: "This is what a reminder from HYPE looks like." },
  tn: { title: "التذكيرات مفعّلة", body: "هكذا يصلك تذكير من HYPE." },
};
