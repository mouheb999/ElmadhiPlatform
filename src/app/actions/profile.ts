"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { normalizePhone } from "@/lib/phone";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Save the account's contact number.
 *
 * Normalised server-side rather than trusting the client: the form does the
 * same check for instant feedback, but this is the one that decides what gets
 * stored, so every row ends up in the same E.164 shape and the column's CHECK
 * never has to reject anything.
 *
 * Migration 013 revoked blanket UPDATE on `profiles` and 039 added `phone` to
 * the column whitelist, so this write cannot touch a payment column even if
 * something upstream went wrong.
 */
export async function savePhone(input: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");

  const phone = normalizePhone(input);
  if (!phone) return fail("invalid");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return fail(error.message);

  // The gate in proxy.ts reads this column on the next request; the layout
  // shows it in settings. Both need to stop seeing the old value.
  revalidatePath("/", "layout");
  return ok(undefined);
}
