import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CalorieAiClient } from "@/components/ai/calorie-ai-client";

export const dynamic = "force-dynamic";

/**
 * Gemini takes 5–33s to answer a meal photo (measured: the image alone is
 * ~1100 input tokens and the model emits ~1000 thinking tokens before the
 * JSON). That overruns Vercel's default function timeout, which kills the
 * request mid-flight — locally there is no such limit, which is exactly why
 * this only ever fails once deployed.
 *
 * Server Actions inherit the timeout of the PAGE that invokes them, not of
 * the file they live in, so this has to sit here rather than in
 * app/actions/ai-estimate.ts. 60s is the ceiling on Vercel's Hobby plan.
 */
export const maxDuration = 60;

/**
 * AI calorie calculator: photograph a meal → estimate → edit → log.
 * Premium-only (real per-use API cost); admins always pass.
 */
export default async function AiCaloriePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_type, is_admin")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.plan_type !== "premium" && !profile?.is_admin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15">
          <Sparkles className="h-10 w-10 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "ai.premium_title")}</h1>
          <p className="mx-auto mt-2 max-w-xs text-muted">{t(locale, "ai.premium_body")}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/checkout">{t(locale, "ai.premium_cta")}</Link>
        </Button>
      </div>
    );
  }

  return <CalorieAiClient locale={locale} />;
}
