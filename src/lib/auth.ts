import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

export type AdminUser = {
  id: string;
  email: string | null;
};

/**
 * Returns the current user if they are an admin, otherwise null.
 * Use this in admin pages/actions before touching the service-role client.
 *
 * Deduped per request: the admin layout and the page beneath it both call this,
 * and there is no reason to ask the database twice in one render.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return null;
  return { id: user.id, email: user.email };
});

/** Throws if the current user is not an admin. Returns the admin user. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized.");
  return admin;
}
