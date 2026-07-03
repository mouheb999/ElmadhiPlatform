import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { QaFeed } from "@/components/qa/qa-feed";

export const dynamic = "force-dynamic";

export default async function QaPage() {
  const supabase = await createClient();
  const locale = await getLocale();

  const [{ data: categories }, { data: cards }] = await Promise.all([
    supabase.from("qa_categories").select("id, slug, name_en, name_ar").order("order_index", { ascending: true }),
    supabase
      .from("qa_cards")
      .select("id, category_id, question_en, question_ar, answer_short, answer_short_ar")
      .eq("is_published", true)
      .order("order_index", { ascending: true }),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.slug]));

  return (
    <QaFeed
      locale={locale}
      categories={(categories ?? []).map((c) => ({ slug: c.slug, nameEn: c.name_en, nameAr: c.name_ar }))}
      cards={(cards ?? []).map((c) => ({
        id: c.id,
        categorySlug: c.category_id ? (categoryById.get(c.category_id) ?? null) : null,
        questionEn: c.question_en,
        questionAr: c.question_ar,
        answerShort: c.answer_short,
        answerShortAr: c.answer_short_ar,
      }))}
    />
  );
}
