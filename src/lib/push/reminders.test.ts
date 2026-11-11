import { describe, expect, it } from "vitest";
import { REMINDER_COPY, pickReminder, type ReminderState } from "./reminders";

const NOW = new Date("2026-11-11T17:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

const base: ReminderState = {
  paid: false,
  freeAccessUntil: null,
  lastActivityAt: null,
  loggedToday: false,
  lastSentAt: null,
  lastKind: null,
};

describe("the free days", () => {
  it("warns on the last day, and only then", () => {
    expect(pickReminder({ ...base, freeAccessUntil: at(20 * HOUR) }, NOW)).toBe("trial_last_day");
    // Two days left: an ordinary day, so the ordinary nudge.
    expect(pickReminder({ ...base, freeAccessUntil: at(2 * DAY) }, NOW)).toBe("log_today");
  });

  it("says so the day after they end, once more on day four, then stops", () => {
    const ended = (daysAgo: number, extra: Partial<ReminderState> = {}) =>
      pickReminder({ ...base, freeAccessUntil: at(-daysAgo * DAY - HOUR), ...extra }, NOW);
    expect(ended(0)).toBe("trial_ended");
    expect(ended(2)).toBeNull();
    expect(ended(3)).toBe("trial_ended");
    expect(ended(6)).toBeNull();
    expect(ended(30)).toBeNull();
  });

  it("does not send the ended message two days running", () => {
    const state = {
      ...base,
      freeAccessUntil: at(-DAY - HOUR),
      lastSentAt: at(-DAY),
      lastKind: "trial_ended",
    };
    expect(pickReminder(state, NOW)).toBeNull();
  });

  it("never talks about a trial to somebody who has paid", () => {
    const paid = { ...base, paid: true, freeAccessUntil: at(10 * HOUR), loggedToday: true, lastActivityAt: at(-HOUR) };
    expect(pickReminder(paid, NOW)).toBeNull();
    expect(pickReminder({ ...paid, freeAccessUntil: at(-DAY) }, NOW)).toBeNull();
  });
});

describe("using the app", () => {
  const member = { ...base, paid: true };

  it("nudges an active member who has not logged today", () => {
    expect(pickReminder({ ...member, lastActivityAt: at(-20 * HOUR) }, NOW)).toBe("log_today");
  });

  it("leaves alone a member who already logged today", () => {
    expect(pickReminder({ ...member, lastActivityAt: at(-2 * HOUR), loggedToday: true }, NOW)).toBeNull();
  });

  it("asks them back after two quiet days, and gives up after two weeks", () => {
    expect(pickReminder({ ...member, lastActivityAt: at(-3 * DAY) }, NOW)).toBe("come_back");
    expect(pickReminder({ ...member, lastActivityAt: at(-13 * DAY) }, NOW)).toBe("come_back");
    expect(pickReminder({ ...member, lastActivityAt: at(-15 * DAY) }, NOW)).toBeNull();
  });

  it("does not remind a locked-out account to use an app it cannot open", () => {
    expect(pickReminder({ ...base, lastActivityAt: at(-3 * DAY) }, NOW)).toBeNull();
    expect(pickReminder(base, NOW)).toBeNull();
  });
});

describe("not being a nuisance", () => {
  const member = { ...base, paid: true, lastActivityAt: at(-20 * HOUR) };

  it("sends at most one a day to a browser", () => {
    expect(pickReminder({ ...member, lastSentAt: at(-3 * HOUR), lastKind: "come_back" }, NOW)).toBeNull();
  });

  it("does not repeat the same nudge on consecutive days", () => {
    expect(pickReminder({ ...member, lastSentAt: at(-DAY), lastKind: "log_today" }, NOW)).toBeNull();
    expect(pickReminder({ ...member, lastSentAt: at(-2 * DAY), lastKind: "log_today" }, NOW)).toBe("log_today");
    // A different reminder the next day is fine.
    expect(pickReminder({ ...member, lastSentAt: at(-DAY), lastKind: "come_back" }, NOW)).toBe("log_today");
  });
});

describe("the copy", () => {
  it("has a title, a body and a same-origin path in both languages for every reminder", () => {
    for (const copy of Object.values(REMINDER_COPY)) {
      expect(copy.url.startsWith("/")).toBe(true);
      for (const text of [copy.en, copy.tn]) {
        expect(text.title.length).toBeGreaterThan(3);
        expect(text.body.length).toBeGreaterThan(10);
        // A lock screen cuts long bodies off.
        expect(text.body.length).toBeLessThanOrEqual(110);
      }
    }
  });
});
