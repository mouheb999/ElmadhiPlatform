import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { FoodsClient } from "./foods-client";

export const dynamic = "force-dynamic";

export default async function AdminFoodsPage() {
  const locale = await getLocale();
  const db = createAdminClient();

  // Explicit column list: never SELECT * here — it would pull the heavy
  // `search_vector` tsvector for every row and bloat the payload.
  const { data: foods } = await db
    .from("foods")
    .select(
      "id, name_ar, name_en, name_fr, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, typical_serving_g, price_tnd_per_kg, price_tier, allergens, tags, is_common, image_url, created_at",
    )
    .order("category", { ascending: true })
    .order("name_en", { ascending: true });

  return <FoodsClient locale={locale} foods={foods ?? []} />;
}
