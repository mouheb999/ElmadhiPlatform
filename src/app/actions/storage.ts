"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, ok, fail } from "@/lib/action-result";

const ALLOWED_BUCKETS = ["food-images", "exercise-images"] as const;
type Bucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Raster formats only, and an allow-list rather than an `image/*` prefix.
 *
 * `image/svg+xml` passes a prefix check and is not a picture — it is a document
 * that can carry <script>. These buckets are PUBLIC and are served from the
 * storage origin to every user in the app, so one stored SVG is script running
 * against everyone who opens a food or exercise image.
 */
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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
  if (!ALLOWED_TYPES[file.type]) return fail("Use a JPG, PNG, WebP or GIF.");
  if (file.size > MAX_BYTES) return fail("Image must be under 5 MB.");

  // Extension chosen by us from the (allow-listed) type, not taken from the
  // uploaded filename. `file.name` is entirely caller-controlled: splitting on
  // "." and keeping the tail let a name like "x.jpg/../../thing" put slashes
  // and traversal segments into the object key.
  const path = `${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return fail(error.message);

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return ok(data.publicUrl);
}
