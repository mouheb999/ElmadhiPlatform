import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthStart, QA_DEFAULT_MONTHLY_LIMIT } from "@/lib/qa";
import { pick } from "@/lib/i18n";
import { QaRequestsClient, type TriageRequest, type TriageCategory } from "./qa-requests-client";
import { QaQuotaClient, type QuotaRow } from "./qa-quota-client";
import { QaLibraryClient, type LibraryCard } from "./qa-library-client";

export const dynamic = "force-dynamic";

/** Q&A triage: answer user questions → publish to the library + notify asker.
 *  AdminLayout already gates access; reads use the service-role client
 *  because qa_requests RLS only exposes each user's own rows. */
export default async function AdminQaPage() {
  const locale = await getLocale();
  const admin = createAdminClient();
  const since = monthStart();

  type RequestRow = {
    id: string;
    question_text: string;
    created_at: string | null;
    profiles: { email: string | null } | null;
  };

  type MonthRow = {
    user_id: string;
    status: string;
    created_at: string | null;
    profiles: { email: string | null } | null;
  };

  const [
    { data: requestsRaw },
    { data: categories },
    { data: settings },
    { data: monthRaw },
    { data: libraryRaw },
  ] = await Promise.all([
    admin
      .from("qa_requests")
      .select("id, question_text, created_at, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    admin
      .from("qa_categories")
      .select("id, name_en, name_ar")
      .order("order_index", { ascending: true }),
    admin.from("qa_settings").select("monthly_question_limit").eq("id", 1).maybeSingle(),
    admin
      .from("qa_requests")
      .select("user_id, status, created_at, profiles(email)")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    // Every card, published or not — hidden ones have to be findable to unhide.
    admin
      .from("qa_cards")
      .select("id, question_en, question_ar, category_id, is_published, external_id")
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

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const libraryCards: LibraryCard[] = (libraryRaw ?? []).map((c) => {
    const category = c.category_id ? categoryById.get(c.category_id) : undefined;
    return {
      id: c.id,
      questionEn: c.question_en,
      questionAr: c.question_ar,
      categoryName: category ? pick(locale, category.name_en, category.name_ar) : null,
      isPublished: c.is_published ?? false,
      externalId: c.external_id,
    };
  });

  // One row per user who asked something this month, heaviest askers first.
  // Rows arrive newest-first, so the first one seen per user is their latest.
  const usage = new Map<string, QuotaRow>();
  for (const row of (monthRaw ?? []) as unknown as MonthRow[]) {
    const existing = usage.get(row.user_id) ?? {
      userId: row.user_id,
      email: row.profiles?.email ?? null,
      used: 0,
      pending: 0,
      published: 0,
      lastAskedAt: row.created_at,
    };
    existing.used += 1;
    if (row.status === "pending") existing.pending += 1;
    if (row.status === "published") existing.published += 1;
    usage.set(row.user_id, existing);
  }
  const quotaRows = [...usage.values()].sort((a, b) => b.used - a.used);

  const monthLabel = since.toLocaleDateString(locale === "tn" ? "ar-TN" : "en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "admin.qa_title")}</h1>
        <p className="text-muted">{t(locale, "admin.qa_sub")}</p>
      </div>
      <QaQuotaClient
        locale={locale}
        limit={settings?.monthly_question_limit ?? QA_DEFAULT_MONTHLY_LIMIT}
        rows={quotaRows}
        monthLabel={monthLabel}
      />
      <QaRequestsClient locale={locale} requests={requests} categories={triageCategories} />
      <QaLibraryClient locale={locale} cards={libraryCards} />
    </div>
  );
}
