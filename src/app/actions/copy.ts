"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStringKey } from "@/lib/i18n";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export type CopyEdit = { key: string; locale: string; value: string };

const MAX_VALUE_LENGTH = 2000;
/** One publish is one screen's worth of edits, not a bulk import. */
const MAX_EDITS = 200;

/**
 * Publishes copy edits.
 *
 * Writes with the service-role client after `requireAdmin`, because
 * `copy_overrides` grants no write policy to anyone (migration 042). That is
 * deliberate: `key` is free text, so a user who could insert rows could rewrite
 * any sentence in the product — including the bank details on the checkout
 * page. This action is the only way in, and it validates every key against the
 * catalogue in code before writing.
 *
 * An empty value deletes the row rather than storing "". Reverting to the
 * shipped default is the common correction after a bad edit, and it should not
 * require knowing what the default was.
 */
export async function publishCopy(edits: CopyEdit[]): Promise<ActionResult<{ published: number }>> {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch {
    return fail("Not authorized.");
  }

  if (!Array.isArray(edits) || edits.length === 0) return fail("Nothing to publish.");
  if (edits.length > MAX_EDITS) return fail("Too many edits at once.");

  const now = new Date().toISOString();
  const upserts: {
    key: string;
    locale: string;
    value: string;
    updated_at: string;
    updated_by: string;
  }[] = [];
  const deletes: { key: string; locale: string }[] = [];

  for (const edit of edits) {
    if (typeof edit?.key !== "string" || !isStringKey(edit.key)) {
      return fail(`Unknown copy key: ${String(edit?.key)}`);
    }
    if (edit.locale !== "en" && edit.locale !== "tn") {
      return fail(`Unknown locale: ${String(edit?.locale)}`);
    }
    const value = typeof edit.value === "string" ? edit.value : "";
    if (value.length > MAX_VALUE_LENGTH) return fail("That text is too long.");

    if (value.trim() === "") deletes.push({ key: edit.key, locale: edit.locale });
    else
      upserts.push({
        key: edit.key,
        locale: edit.locale,
        value,
        updated_at: now,
        updated_by: adminId,
      });
  }

  const admin = createAdminClient();

  if (upserts.length > 0) {
    const { error } = await admin
      .from("copy_overrides")
      .upsert(upserts, { onConflict: "key,locale" });
    if (error) return fail(error.message);
  }

  for (const row of deletes) {
    const { error } = await admin
      .from("copy_overrides")
      .delete()
      .eq("key", row.key)
      .eq("locale", row.locale);
    if (error) return fail(error.message);
  }

  // Copy appears on every screen, so the whole tree is stale, not one route.
  revalidatePath("/", "layout");
  return ok({ published: upserts.length + deletes.length });
}
