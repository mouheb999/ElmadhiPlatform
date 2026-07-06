import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { QaRequestsClient, type TriageRequest, type TriageCategory } from "./qa-requests-client";

export const dynamic = "force-dynamic";

/** Q&A triage: answer user questions → publish to the library + notify asker.
 *  AdminLayout already gates access; reads use the service-role client
 *  because qa_requests RLS only exposes each user's own rows. */
export default async function AdminQaPage() {
  const locale = await getLocale();
  const admin = createAdminClient();

  type RequestRow = {
    id: string;
    question_text: string;
    created_at: string | null;
    profiles: { email: string | null } | null;
  };

  const [{ data: requestsRaw }, { data: categories }] = await Promise.all([
    admin
      .from("qa_requests")
      .select("id, question_text, created_at, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    admin
      .from("qa_categories")
      .select("id, name_en, name_ar")
      .order("order_index", { ascending: true }),
  ]);

  const requests: TriageRequest[] = ((requestsRaw ?? []) as unknown as RequestRow[]).map((r) => ({
    id: r.id,
    questionText: r.question_text,
    email: r.profiles?.email ?? null,
    createdAt: r.created_at,
  }));

  const triageCategories: TriageCategory[] = (categories ?? []).map((c) => ({
    id: c.id,
    nameEn: c.name_en,
    nameAr: c.name_ar,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "admin.qa_title")}</h1>
        <p className="text-muted">{t(locale, "admin.qa_sub")}</p>
      </div>
      <QaRequestsClient locale={locale} requests={requests} categories={triageCategories} />
    </div>
  );
}
