import { createClient } from "@/lib/supabase/server";

export type AdminUser = {
  id: string;
  email: string | null;
};

/**
 * Returns the current user if they are an admin, otherwise null.
 * Use this in admin pages/actions before touching the service-role client.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return null;
  return { id: user.id, email: user.email ?? null };
}

/** Throws if the current user is not an admin. Returns the admin user. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized.");
  return admin;
}
