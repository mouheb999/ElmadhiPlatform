import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Every published copy override, keyed `"<locale>:<key>"` for `applyCopyOverrides`.
 *
 * Request-cached, so the root layout's read is the only one per render even
 * though the value is applied process-wide.
 *
 * Fails closed to no overrides. Migrations on this project are applied by hand,
 * so there is always a window where the code is deployed and the table is not —
 * and "the copy editor is not live yet" has to degrade to the built-in English
 * and Arabic, never to a 500 on every page in the product.
 */
export const getCopyOverrides = cache(async (): Promise<Record<string, string>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("copy_overrides")
      .select("key, locale, value");
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [`${row.locale}:${row.key}`, row.value]));
  } catch {
    return {};
  }
});
