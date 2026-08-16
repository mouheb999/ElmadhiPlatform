/**
 * Bounds on the shape of a program and a meal plan.
 *
 * A plain module, not a `"use server"` one, for the same reason
 * `exercises-meta.ts` is: a server-action file may only export async functions,
 * and a single exported constant in one turns every other export in it into a
 * server reference — the whole module then imports as empty.
 *
 * These are ceilings, not opinions. The builders are the one place a client
 * posts a whole plan rather than an answer to a question, so they exist to stop
 * a malformed or scripted payload becoming thousands of rows. All of them sit
 * far outside anything the UI can produce.
 */

/** Training days in a week. The rest of the app assumes this range too — the
 *  weekly gate and the dashboard's "days trained" maths both read it. */
export const MIN_PROGRAM_DAYS = 2;
export const MAX_PROGRAM_DAYS = 6;

/** Past this a day is not a workout anybody finishes. */
export const MAX_EXERCISES_PER_DAY = 15;

export const MAX_SETS = 10;
export const MAX_REST_SECONDS = 600;

/** "8" or "8-12". Anything else is rejected rather than silently normalised. */
export const REP_RANGE_PATTERN = /^\d{1,2}(-\d{1,2})?$/;

/** Foods in one planned meal. */
export const MAX_ITEMS_PER_MEAL = 12;

/** Grams in one portion. Above this is a typo or a script, not a serving. */
export const MAX_QUANTITY_G = 2000;
