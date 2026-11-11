"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { getSubscription } from "@/lib/subscription-server";
import { GATE_COOKIE } from "@/lib/paywall-gate";
import { type ActionResult, fail } from "@/lib/action-result";
import { DELETE_CONFIRMATION, type DeleteAccountError } from "@/lib/account-deletion";

/** Private bucket holding payment receipts, one folder per user id. */
const PROOF_BUCKET = "payment-proofs";

/**
 * Removes every receipt the user uploaded. Storage objects are not rows, so
 * deleting the account does not cascade to them: without this they would
 * outlive the account indefinitely.
 */
async function removeUploadedFiles(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  for (;;) {
    const { data, error } = await admin.storage.from(PROOF_BUCKET).list(userId, { limit: 100 });
    if (error) return error.message;
    if (!data || data.length === 0) return null;
    const { error: removeError } = await admin.storage
      .from(PROOF_BUCKET)
      .remove(data.map((file) => `${userId}/${file.name}`));
    if (removeError) return removeError.message;
    if (data.length < 100) return null;
  }
}

/**
 * The member deletes their own account, from Settings.
 *
 * Required by both stores: Google Play's data-deletion policy and App Store
 * rule 5.1.1(v) say an app that creates accounts must let people delete them
 * from inside the app. It is immediate and complete:
 *
 *   1. their uploaded receipts are removed from storage;
 *   2. the auth user is deleted, and every row hanging off it — profile,
 *      programs, sessions and sets, meal plans and logs, check-ins, Q&A,
 *      support threads, payment requests — goes with it through the
 *      database's ON DELETE CASCADE (the same path the admin delete uses);
 *   3. the session cookies are cleared and they land on a confirmation page.
 *
 * Files go first: if removing them fails, the account is left in place and
 * the user can try again, rather than ending up with the account gone and
 * receipts orphaned where nothing can find them.
 *
 * `confirmation` is a constant the confirm button sends, not something typed:
 * Apple asks that deleting be easy to find and do, and making someone type
 * their email on a phone keyboard works against that. The two-step dialog is
 * the guard against a mistaken tap; this only stops a stray POST.
 *
 * Admin accounts are refused, so the last admin cannot lock everybody out of
 * the panel by accident. Another admin removes their rights first.
 */
export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  // Errors are codes, translated by the screen: the reader may be in Arabic.
  const failWith = (code: DeleteAccountError) => fail(code);

  if (confirmation !== DELETE_CONFIRMATION) return failWith("failed");

  const user = await getCurrentUser();
  if (!user) return failWith("signed_out");

  const subscription = await getSubscription();
  if (subscription.is_admin) return failWith("admin");

  const admin = createAdminClient();

  const filesError = await removeUploadedFiles(admin, user.id);
  if (filesError) {
    console.error("[account] receipt removal failed:", filesError);
    return failWith("failed");
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed:", error.message);
    return failWith("failed");
  }

  // The user no longer exists, so a server-side sign-out call would fail;
  // clearing the session locally is what removes the cookies.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(GATE_COOKIE);

  redirect("/delete-account?done=1");
}
