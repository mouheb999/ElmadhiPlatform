"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Admin actions on the subscriptions list.
 *
 * Two different kinds of "remove", kept apart on purpose: ending access is a
 * billing decision and reversible, deleting the account destroys everything the
 * person ever logged. Sharing one button between them is how the second one
 * happens by accident.
 */

/** The gate reads payment_status, plan_expires_at and is_admin — clearing the
 *  first two is exactly what "no longer subscribed" means to the whole app. */
export async function endSubscription(userId: string): Promise<ActionResult> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  // Locking yourself out of the admin panel mid-session is a hole with no
  // ladder: the panel is the only place to undo it.
  if (userId === adminUserId) return fail("You can't end your own subscription.");

  const db = createAdminClient();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, email, payment_status")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return fail(profileError.message);
  if (!profile) return fail("Account not found.");

  const { error } = await db
    .from("profiles")
    .update({
      payment_status: "unpaid",
      plan_expires_at: null,
      has_paid: false,
      // /ai gates on plan_type separately; leaving it at premium would keep a
      // lapsed account's most expensive feature nominally switched on.
      plan_type: "free",
    })
    .eq("id", userId);
  if (error) return fail(error.message);

  // paid_at is left alone: it is the record that they once paid, and the next
  // activation reads plan_expires_at (now null) rather than this.
  await db.from("events").insert({
    user_id: userId,
    event_type: "subscription_ended_by_admin",
    payload: { by: adminUserId, previous_status: profile.payment_status },
  });

  revalidatePath("/admin/subscriptions");
  return ok(undefined);
}

/**
 * Deletes the account outright. Everything hanging off the user cascades with
 * it — workouts, meals, check-ins, the lot. There is no undo, so the caller
 * must type the address back, and the check is repeated here: a stale userId
 * from a re-used form must not be able to resolve to somebody else.
 */
export async function deleteAccount(
  userId: string,
  confirmEmail: string,
): Promise<ActionResult> {
  let adminUserId: string;
  try {
    adminUserId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  if (userId === adminUserId) return fail("You can't delete your own account.");

  const db = createAdminClient();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, email, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return fail(profileError.message);
  if (!profile) return fail("Account not found.");

  // Another admin has to be demoted first. Typing an address correctly is a
  // thin guard for destroying a colleague's account.
  if (profile.is_admin) {
    return fail("This is an admin account — remove its admin rights first.");
  }

  const typed = confirmEmail.trim().toLowerCase();
  if (!typed || typed !== (profile.email ?? "").trim().toLowerCase()) {
    return fail("The confirmation email doesn't match this account.");
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return fail(error.message);

  revalidatePath("/admin/subscriptions");
  return ok(undefined);
}
