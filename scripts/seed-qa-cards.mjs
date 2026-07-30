// Loads the visual FAQ card set into qa_categories + qa_cards.
//
// Source of truth: supabase/seed/qa_visual_faq_cards_v1.json (the content file
// as delivered — never edited in place, so a new drop can just replace it),
// plus qa_visual_faq_cards_v1.en.json, the English companion keyed by the same
// card ids. Every card is written bilingual: English into the plain columns,
// Tunisian into the `_ar` ones. A card missing from the English file is a hard
// error rather than a silently half-translated row.
// Every card carries a stable `id` (faq_001…), which we store as
// `qa_cards.external_id` and upsert on, so re-running is safe and an updated
// content file overwrites the cards it changed without touching anything an
// admin published through triage.
//
// Requires migration 031. Run with: npm run seed:qa (add -- --dry-run to
// print what would be written without touching the database).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const dryRun = process.argv.includes("--dry-run");

// --- env -------------------------------------------------------------
// The app reads .env.local through Next; a plain node script has to do it.
async function connect() {
  const env = Object.fromEntries(
    (await readFile(path.join(root, ".env.local"), "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
    process.exit(1);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const supabase = dryRun ? null : await connect();

// --- content ---------------------------------------------------------
const source = JSON.parse(
  await readFile(path.join(root, "supabase", "seed", "qa_visual_faq_cards_v1.json"), "utf8"),
);
const englishByCardId = JSON.parse(
  await readFile(path.join(root, "supabase", "seed", "qa_visual_faq_cards_v1.en.json"), "utf8"),
).cards;

const untranslated = source.cards.filter((c) => !englishByCardId[c.id]?.question);
if (untranslated.length) {
  console.error(`No English for: ${untranslated.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

// The content file's category keys vs. the slugs already in the database.
// `recovery` and `supplements` predate this content set and are referenced by
// the weekly review (src/app/(app)/review/page.tsx), so they keep their slugs.
const CATEGORY_SLUG = {
  nutrition: "nutrition",
  training: "training",
  running_walking: "running_walking",
  recovery_injury: "recovery",
  women_cycle: "women_cycle",
  supplements_mindset: "supplements",
};

// Each block repeats its own label inline ("الفكرة العلمية: …") and the card UI
// already prints that label above the text. Strip it so it isn't shown twice.
const BLOCK_PREFIXES = [
  "الفكرة العلمية:",
  "طبّقها اليوم:",
  "طبّقيها اليوم:",
  "غلط شائع:",
  "نصيحة ELMADHI:",
  "تنبيه:",
];

function stripLabel(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const prefix = BLOCK_PREFIXES.find((p) => trimmed.startsWith(p));
  return (prefix ? trimmed.slice(prefix.length).trim() : trimmed) || null;
}

/**
 * `short_answer` is derived from `original_answer` in the content file and a
 * few rows got cut at the first period ("…تقريبًا 1." for "…1.6–2.2 غ/كغ").
 * When one is a prefix of the other, keep the complete one.
 */
function quickAnswer(card) {
  const short = (card.short_answer ?? "").trim();
  const original = (card.original_answer ?? "").trim();
  if (short && original && original.startsWith(short) && original.length > short.length) return original;
  return short || original;
}

// --- categories ------------------------------------------------------
const categoryRows = Object.entries(source.categories).map(([, value], index) => ({
  slug: CATEGORY_SLUG[value.key] ?? value.key,
  name_ar: value.label,
  order_index: index + 1,
  icon: value.icon,
  accent_color: value.accent_color,
}));

const categoryIdBySlug = new Map(categoryRows.map((r) => [r.slug, `dry-run-${r.slug}`]));
// Cards an admin hid in /admin/qa must stay hidden across a re-seed —
// otherwise every content refresh silently republishes them.
const publishedByExternalId = new Map();

if (!dryRun) {
  for (const row of categoryRows) {
    // Upsert by slug without clobbering name_en, which migration 031 seeds.
    const { error } = await supabase
      .from("qa_categories")
      .update({
        name_ar: row.name_ar,
        order_index: row.order_index,
        icon: row.icon,
        accent_color: row.accent_color,
      })
      .eq("slug", row.slug);
    if (error) {
      console.error(`Category ${row.slug}: ${error.message}`);
      process.exit(1);
    }
  }

  const { data: categories, error: categoryError } = await supabase
    .from("qa_categories")
    .select("id, slug");
  if (categoryError) {
    console.error(categoryError.message);
    process.exit(1);
  }

  categoryIdBySlug.clear();
  for (const c of categories) categoryIdBySlug.set(c.slug, c.id);

  const missing = [...new Set(categoryRows.map((r) => r.slug))].filter((s) => !categoryIdBySlug.has(s));
  if (missing.length) {
    console.error(`Missing categories: ${missing.join(", ")}. Apply migration 031 first.`);
    process.exit(1);
  }

  const { data: existing, error: existingError } = await supabase
    .from("qa_cards")
    .select("external_id, is_published")
    .not("external_id", "is", null);
  if (existingError) {
    console.error(existingError.message);
    process.exit(1);
  }
  for (const row of existing) publishedByExternalId.set(row.external_id, row.is_published);
}

// --- cards -----------------------------------------------------------
const cards = source.cards.map((card) => {
  const slug = CATEGORY_SLUG[card.category] ?? card.category;
  const short = quickAnswer(card);
  const original = (card.original_answer ?? "").trim();
  const en = englishByCardId[card.id];
  return {
    external_id: card.id,
    category_id: categoryIdBySlug.get(slug) ?? null,
    question_en: en.question,
    question_ar: card.question,
    answer_short: en.short_answer,
    answer_short_ar: short,
    science_explanation: en.science_explanation,
    practical_application: en.practical_application,
    common_mistake: en.common_mistake,
    coach_tip: en.coach_tip,
    warning: en.warning,
    // Only keep the original wording when it says something the quick answer
    // doesn't — otherwise the reader would show the same sentence twice.
    answer_long_md_ar: original && original !== short ? original : null,
    science_explanation_ar: stripLabel(card.science_explanation),
    practical_application_ar: stripLabel(card.practical_application),
    common_mistake_ar: stripLabel(card.common_mistake),
    coach_tip_ar: stripLabel(card.coach_tip),
    warning_ar: stripLabel(card.warning),
    difficulty_level: card.difficulty_level ?? null,
    estimated_read_time: card.estimated_read_time ?? null,
    icon: card.visual?.icon ?? null,
    accent_color: card.visual?.accent_color ?? null,
    visual_type: card.visual?.layout ?? null,
    order_index: Number.parseInt(String(card.id).replace(/\D/g, ""), 10) || 0,
    is_published: publishedByExternalId.get(card.id) ?? true,
  };
});

if (dryRun) {
  const perCategory = {};
  for (const card of cards) {
    const slug = [...categoryIdBySlug.entries()].find(([, id]) => id === card.category_id)?.[0] ?? "?";
    perCategory[slug] = (perCategory[slug] ?? 0) + 1;
  }
  console.log(`Dry run — ${cards.length} cards across`, perCategory);
  console.log("With a warning:", cards.filter((c) => c.warning_ar).length);
  console.log("Keeping a longer original answer:", cards.filter((c) => c.answer_long_md_ar).length);
  console.log("\nFirst card:\n", JSON.stringify(cards[0], null, 2));
  process.exit(0);
}

const { error: cardError } = await supabase
  .from("qa_cards")
  .upsert(cards, { onConflict: "external_id" });
if (cardError) {
  console.error(cardError.message);
  process.exit(1);
}

console.log(`Seeded ${categoryRows.length} categories and ${cards.length} Q&A cards.`);
