import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function QaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();

  const { data: card } = await supabase
    .from("qa_cards")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (!card) notFound();

  const body = pick(locale, card.answer_long_md, card.answer_long_md_ar);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <Link href="/qa" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {locale === "tn" ? "لوراء" : "Back"}
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight">{pick(locale, card.question_en, card.question_ar)}</h1>
      <p className="text-lg text-accent">{pick(locale, card.answer_short, card.answer_short_ar)}</p>

      {body && (
        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-muted">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
