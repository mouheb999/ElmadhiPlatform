import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Diet Maker has no landing screen once a plan exists — tapping into it
 * goes straight to the plan. "Redo my diet goals" lives only in Settings. */
export default async function DietLandingPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  if (dietProfile) redirect("/diet/plan");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "dashboard.diet_title")}</h1>
      <p className="max-w-xs text-muted">{t(locale, "dashboard.diet_not_started")}</p>
      <Button asChild size="lg">
        <Link href="/diet/questions">{t(locale, "dashboard.cta_start")}</Link>
      </Button>
    </div>
  );
}
