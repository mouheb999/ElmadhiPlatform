import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Service-role client. Bypasses RLS. ONLY use in trusted server contexts that
 * have no user session (e.g. payment webhooks). Never import into client code.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
