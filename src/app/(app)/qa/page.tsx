import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { getQaQuota } from "@/lib/qa";
import { QaFeed } from "@/components/qa/qa-feed";
import { AnsweredBanner, type AnsweredRequest } from "@/components/qa/answered-banner";

export const dynamic = "force-dynamic";

export default async function QaPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const user = await getCurrentUser();

  const [{ data: categories }, { data: cards }, { data: answeredRaw }, quota] = await Promise.all([
    supabase
      .from("qa_categories")
      .select("id, slug, name_en, name_ar, icon, accent_color")
      .order("order_index", { ascending: true }),
    supabase
      .from("qa_cards")
      .select("id, category_id, question_en, question_ar, answer_short, answer_short_ar, icon, accent_color")
      .eq("is_published", true)
      .order("order_index", { ascending: true }),
    user
      ? supabase
          .from("qa_requests")
          .select("id, question_text, promoted_qa_card_id")
          .eq("user_id", user.id)
          .eq("status", "published")
          .is("answered_seen_at", null)
          .not("promoted_qa_card_id", "is", null)
      : Promise.resolve({ data: null }),
    user ? getQaQuota(supabase, user.id) : Promise.resolve(null),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const answered: AnsweredRequest[] = (answeredRaw ?? []).map((r) => ({
    requestId: r.id,
    cardId: r.promoted_qa_card_id!,
    questionText: r.question_text,
  }));

  return (
    <div className="flex flex-col gap-4">
      <AnsweredBanner locale={locale} answered={answered} />
      <QaFeed
        locale={locale}
        quota={quota}
        categories={(categories ?? []).map((c) => ({
          slug: c.slug,
          nameEn: c.name_en,
          nameAr: c.name_ar,
          accentColor: c.accent_color,
        }))}
        cards={(cards ?? []).map((c) => {
          const category = c.category_id ? categoryById.get(c.category_id) : undefined;
          return {
            id: c.id,
            categorySlug: category?.slug ?? null,
            questionEn: c.question_en,
            questionAr: c.question_ar,
            answerShort: c.answer_short,
            answerShortAr: c.answer_short_ar,
            icon: c.icon ?? category?.icon ?? null,
            accentColor: c.accent_color ?? category?.accent_color ?? null,
          };
        })}
      />
    </div>
  );
}
