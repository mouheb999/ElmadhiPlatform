import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import { isSubscriptionActive, type SubscriptionProfile } from "@/lib/subscription";

import { SUBSCRIPTION_REQUIRED } from "@/lib/subscription";

export { SUBSCRIPTION_REQUIRED };

/**
 * The paywall, checked next to the data instead of in front of the route.
 *
 * `proxy.ts` redirects an unpaid or lapsed user away from the paid pages, and
 * that is the right place for it: one cheap check covering every navigation.
 * But it is a *path* check, and Server Functions are reachable by a direct
 * POST to any path the matcher lets through — /support and /checkout are
 * deliberately open so a locked-out customer can still reach an admin and
 * still pay. An action that only asks "are you signed in?" is therefore
 * reachable by an expired account, and some of them (the AI estimate) cost
 * real money per call.
 *
 * So every action behind the paywall calls `getPaidUser()`. The proxy stays
 * the fast optimistic check; this is the boundary that actually holds.
 *
 * Deliberately NOT guarded, because a lapsed user must still be able to use
 * them: sign-in/out, the locale switch, `createPaymentRequest` (that is how
 * they renew), and the user side of support. Admin actions have `requireAdmin`.
 */

export type SubscriptionState = SubscriptionProfile & {
  /** May this account use the paid product right now? */
  active: boolean;
};

/**
 * The signed-in user's subscription. Deduped per request, so an action that
 * guards itself and a layout that reads the same row cost one round-trip.
 */
export const getSubscription = cache(async (): Promise<SubscriptionState> => {
  const user = await getCurrentUser();
  if (!user) return { active: false, is_admin: false, payment_status: null, plan_expires_at: null };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, is_admin, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  return { ...profile, active: isSubscriptionActive(profile) };
});

/**
 * Guard for a paid action — the user, or the reason they were turned away.
 * Paid actions open with this in place of `getCurrentUser()`:
 *
 *     const { user, denied } = await requirePaidUser();
 *     if (!user) return fail(denied);
 *
 * Signed out and lapsed are told apart on purpose: one sends you to the login
 * screen, the other to checkout, and a user shown the wrong one chases the
 * wrong fix.
 */
export async function requirePaidUser(): Promise<
  { user: CurrentUser; denied?: never } | { user?: never; denied: string }
> {
  const user = await getCurrentUser();
  if (!user) return { denied: "Not signed in." };
  if (!(await getSubscription()).active) return { denied: SUBSCRIPTION_REQUIRED };
  return { user };
}

/** True when the caller may use the paid product. For void actions. */
export async function hasPaidAccess(): Promise<boolean> {
  return (await getSubscription()).active;
}
