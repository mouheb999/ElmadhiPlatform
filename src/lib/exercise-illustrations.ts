import manifest from "@/lib/exercise-illustrations.json";

/**
 * Anatomical exercise illustrations generated from exercise-specs/ and shipped
 * in public/exercise-library/. The manifest (slug -> URL) is rebuilt by
 * scripts/optimize-exercise-images.mjs, so new categories appear here without
 * code changes. Lookup is by slugified English name: DB rows ("Bent-Over
 * Barbell Row") and spec ids ("bent-over-barbell-row") follow the same naming.
 */
const illustrations = manifest as Record<string, string>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function illustrationFor(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  return illustrations[slugify(nameEn)] ?? null;
}
