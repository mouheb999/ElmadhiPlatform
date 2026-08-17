import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import {
  isPremiumActive,
  isSubscriptionActive,
  type SubscriptionProfile,
} from "@/lib/subscription";
import { REVERSE_TRIAL } from "@/lib/access";

import { PREMIUM_REQUIRED, SUBSCRIPTION_REQUIRED } from "@/lib/subscription";

export { PREMIUM_REQUIRED, SUBSCRIPTION_REQUIRED };

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
  /** ...and is it on the Premium tier, which the AI estimator requires? */
  premium: boolean;
};

/**
 * The signed-in user's subscription. Deduped per request, so an action that
 * guards itself and a layout that reads the same row cost one round-trip.
 */
export const getSubscription = cache(async (): Promise<SubscriptionState> => {
  const user = await getCurrentUser();
  if (!user) {
    return {
      active: false,
      premium: false,
      is_admin: false,
      payment_status: null,
      plan_expires_at: null,
      plan_type: null,
    };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, is_admin, plan_expires_at, plan_type")
    .eq("id", user.id)
    .maybeSingle();

  return {
    ...profile,
    active: isSubscriptionActive(profile),
    premium: isPremiumActive(profile),
  };
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

/**
 * Guard for the plan-building actions — the questionnaires, and the edits and
 * swaps on the program and meal plan they produce.
 *
 * Which is to say: the actions whose price depends on which mode the product is
 * in. With `REVERSE_TRIAL` on they are free, because a plan you cannot shape is
 * not a plan you can judge. With it off they are paid like everything else.
 *
 * They need a guard of their own rather than just the route gate because a
 * Server Function is reachable by a direct POST — /checkout and /support stay
 * open by design, so "the proxy will have redirected them" is not true of an
 * action. Same reasoning as `requirePaidUser`; the difference is only that this
 * one is a no-op while the trial is running.
 */
export async function requirePlanUser(): Promise<
  { user: CurrentUser; denied?: never } | { user?: never; denied: string }
> {
  if (!REVERSE_TRIAL) return requirePaidUser();
  const user = await getCurrentUser();
  if (!user) return { denied: "Not signed in." };
  return { user };
}

/** True when the caller is on Premium (or an admin). */
export async function hasPremiumAccess(): Promise<boolean> {
  return (await getSubscription()).premium;
}

/**
 * Guard for a Premium-only action. Same shape as `requirePaidUser`, and told
 * apart from it on purpose: a Standard subscriber is not lapsed, and telling
 * them to renew would send them to fix a problem they do not have.
 */
export async function requirePremiumUser(): Promise<
  { user: CurrentUser; denied?: never } | { user?: never; denied: string }
> {
  const user = await getCurrentUser();
  if (!user) return { denied: "Not signed in." };
  const state = await getSubscription();
  if (!state.active) return { denied: SUBSCRIPTION_REQUIRED };
  if (!state.premium) return { denied: PREMIUM_REQUIRED };
  return { user };
}
