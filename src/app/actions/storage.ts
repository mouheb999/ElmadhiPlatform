"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";

const ALLOWED_BUCKETS = ["food-images", "exercise-images"] as const;
type Bucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image to a public content bucket and return its public URL.
 * Admin only. Uses the service-role client, which bypasses storage RLS.
 * Receives FormData so the browser can stream a File to the server action.
 */
export async function uploadImage(
  formData: FormData,
): Promise<ActionResult<string>> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const bucket = formData.get("bucket");
  const file = formData.get("file");

  if (typeof bucket !== "string" || !ALLOWED_BUCKETS.includes(bucket as Bucket))
    return fail("Invalid bucket.");
  if (!(file instanceof File) || file.size === 0)
    return fail("No file provided.");
  if (!file.type.startsWith("image/")) return fail("File must be an image.");
  if (file.size > MAX_BYTES) return fail("Image must be under 5 MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return fail(error.message);

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return ok(data.publicUrl);
}
