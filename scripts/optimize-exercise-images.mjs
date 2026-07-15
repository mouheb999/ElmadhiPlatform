// Optimizes exercise illustrations for mobile delivery and regenerates the
// slug -> URL manifest the app imports (src/lib/exercise-illustrations.json).
//
// - Converts every public/exercise-library/**/*.png to a 1376px-wide WebP
//   (source PNGs from the generator are ~4.5 MB; the WebP lands around 100 KB)
//   and deletes the PNG so the repo stays light.
// - Rebuilds the manifest from everything that lives in the library, so it
//   works for any category added later without code changes.
//
// Runs automatically at the end of scripts/download-exercise-images.ps1.
import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const libraryDir = path.join(root, "public", "exercise-library");
const manifestPath = path.join(root, "src", "lib", "exercise-illustrations.json");

const categories = (await readdir(libraryDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const manifest = {};

for (const category of categories.sort()) {
  const dir = path.join(libraryDir, category);
  const files = await readdir(dir);

  for (const file of files.filter((f) => f.endsWith(".png")).sort()) {
    const slug = path.basename(file, ".png");
    const source = path.join(dir, file);
    const target = path.join(dir, `${slug}.webp`);
    await sharp(source).resize({ width: 1376 }).webp({ quality: 82 }).toFile(target);
    await rm(source);
    console.log(`optimized ${category}/${slug}.webp`);
  }

  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".webp")).sort()) {
    manifest[path.basename(file, ".webp")] = `/exercise-library/${category}/${file}`;
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest: ${Object.keys(manifest).length} illustrations -> ${path.relative(root, manifestPath)}`);
