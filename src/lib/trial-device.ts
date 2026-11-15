import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One free trial per device, as far as a browser can be held to that.
 *
 * The trial is granted by the database the moment an account is created
 * (migration 058). The phone number on the account is not verified — there is
 * no SMS gateway — so nothing stopped somebody whose three days had run out
 * from signing up again with a made-up number and getting three more, on the
 * same phone, forever.
 *
 * This closes the easy version of that. The first sign-up in a browser leaves
 * a marker; any later sign-up from the same browser has its trial closed
 * straight away, so the new account opens on the "your free days are over"
 * screen instead of inside the app.
 *
 * What it is and is not:
 *
 *   - It is a cookie. `httpOnly`, so page script cannot read or remove it, and
 *     long-lived. It survives closing the browser and signing out.
 *   - It does not survive clearing site data, a private window, a second
 *     browser, or a second device. Somebody determined gets another trial.
 *     Stopping them takes verifying the phone number by SMS, which costs money
 *     per sign-up and is a decision, not a patch.
 *   - It is deliberately not the IP address. Mobile carriers put thousands of
 *     subscribers behind one address, so blocking by IP would refuse a trial
 *     to strangers who share a network with somebody who had one.
 *
 * The honest framing: an abuser already pays a price — every new account
 * starts with an empty plan, no history and five scans a day. This makes the
 * lazy route not work, which is the route nearly everybody would take.
 */
export const TRIAL_DEVICE_COOKIE = "hype_td";

export const TRIAL_DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // Two years. Longer than anybody keeps a phone's browser data by accident.
  maxAge: 60 * 60 * 24 * 365 * 2,
} as const;

/**
 * Has this browser already had a trial on a *different* account?
 *
 * The marker holds the id of the account that used the device's trial, not a
 * bare flag. That matters for Google sign-in, where a brand-new account can
 * pass through the callback twice within minutes — a second tab, a retry — and
 * a bare flag would read the second pass as a second sign-up and close the
 * trial of somebody who has done nothing wrong.
 */
export function isRepeatTrial(marker: string | undefined, userId: string): boolean {
  return !!marker && marker !== userId;
}

/**
 * Close the trial the database just granted to `userId`.
 *
 * Sets the window to now rather than clearing it: an account whose window has
 * closed is one checkout words as "your free days are over", which is the
 * truth about this person, where NULL would word it as a stranger.
 *
 * Needs the service role, because a member cannot write that column. Best
 * effort — if it fails the account simply keeps its trial, which is the state
 * things were in before this existed.
 */
export async function closeRepeatTrial(userId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("profiles")
      .update({ free_access_until: new Date().toISOString() })
      .eq("id", userId);
    if (error) console.error("[trial] repeat trial not closed:", error.message);
  } catch (err) {
    console.error("[trial] repeat trial not closed:", err);
  }
}
