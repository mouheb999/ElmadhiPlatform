/**
 * Machine-readable failure codes for the live-session server actions.
 * The client maps these to i18n strings (session.* keys); any other
 * `error` value coming back from an action is shown raw.
 *
 * Separate module because "use server" files may only export async functions.
 */
export const SESSION_ERR = {
  weekLocked: "week_locked",
  otherInProgress: "other_in_progress",
  notOpen: "not_open",
} as const;

export type SessionErrCode = (typeof SESSION_ERR)[keyof typeof SESSION_ERR];
