import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { fromRow, type ClinicalProfileRow } from "@/lib/clinical/types";
import { ClinicalFileForm } from "@/components/care/clinical-file-form";

export const dynamic = "force-dynamic";

/**
 * Where a care file is started and kept up to date.
 *
 * Reads only the profile — none of the day's readings, none of the logs. It is
 * the one care screen that is about the paperwork rather than about today, and
 * loading a week's state to render a form would be work nobody asked for.
 */
export default async function ClinicalFilePage() {
  const [supabase, locale, user] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
  ]);

  const { data } = await supabase
    .from("clinical_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  const profile = data ? fromRow(data as ClinicalProfileRow) : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        {profile && (
          <Link
            href="/care"
            className="flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            {t(locale, "care.title")}
          </Link>
        )}
        <h1 className="font-display text-3xl font-extrabold">{t(locale, "care.file_title")}</h1>
      </header>

      <ClinicalFileForm locale={locale} profile={profile} />
    </div>
  );
}
