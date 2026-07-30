import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { QaAnswerCard } from "@/components/qa/qa-answer-card";
import type { Database } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function QaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();

  // db.ts declares no relationships, so an embedded select comes back untyped —
  // same cast the admin triage page uses for `profiles(email)`. One query
  // rather than two: the category only carries the card's colour and label.
  type CardRow = Database["public"]["Tables"]["qa_cards"]["Row"] & {
    qa_categories: {
      slug: string;
      name_en: string | null;
      name_ar: string | null;
      icon: string | null;
      accent_color: string | null;
    } | null;
  };

  const { data } = await supabase
    .from("qa_cards")
    .select("*, qa_categories(slug, name_en, name_ar, icon, accent_color)")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  const card = data as CardRow | null;
  if (!card) notFound();
  // A card can override its category's look; most just inherit it.
  const category = card.qa_categories;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <Link href="/qa" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {locale === "tn" ? "لوراء" : "Back"}
      </Link>

      <QaAnswerCard
        locale={locale}
        card={{
          question: pick(locale, card.question_en, card.question_ar),
          shortAnswer: pick(locale, card.answer_short, card.answer_short_ar),
          science: pick(locale, card.science_explanation, card.science_explanation_ar) || null,
          practical: pick(locale, card.practical_application, card.practical_application_ar) || null,
          mistake: pick(locale, card.common_mistake, card.common_mistake_ar) || null,
          tip: pick(locale, card.coach_tip, card.coach_tip_ar) || null,
          warning: pick(locale, card.warning, card.warning_ar) || null,
          longMd: pick(locale, card.answer_long_md, card.answer_long_md_ar) || null,
          difficultyLevel: card.difficulty_level,
          readTime: card.estimated_read_time,
          categoryLabel: category ? pick(locale, category.name_en, category.name_ar) : null,
          icon: card.icon ?? category?.icon ?? category?.slug ?? null,
          accentColor: card.accent_color ?? category?.accent_color ?? null,
        }}
      />
    </div>
  );
}
