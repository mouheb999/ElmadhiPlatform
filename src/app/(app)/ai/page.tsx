import Link from "next/link";
import { Camera, ListChecks, NotebookPen } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { hasPremiumAccess } from "@/lib/subscription-server";
import { t, type StringKey, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CalorieAiClient } from "@/components/ai/calorie-ai-client";
import { PageHeader } from "@/components/shared/page-header";

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

const STEPS: { icon: typeof Camera; title: StringKey; body: StringKey }[] = [
  { icon: Camera, title: "ai.how_1", body: "ai.how_1_body" },
  { icon: ListChecks, title: "ai.how_2", body: "ai.how_2_body" },
  { icon: NotebookPen, title: "ai.how_3", body: "ai.how_3_body" },
];

/**
 * AI calorie calculator: photograph a meal → estimate → edit → log.
 *
 * The route is open to everyone; only the camera is Premium. A feature nobody
 * has seen cannot sell itself, and bouncing a curious user straight to a price
 * list was the habit that made the old funnel fail — so anyone not on Premium
 * gets a walkthrough of what the estimator actually does, on the page they
 * tapped, and decides from there.
 *
 * The walkthrough is not the boundary. `estimateMeal` and its logging
 * counterpart call `requirePremiumUser` themselves, because Server Functions
 * are reachable by direct POST and this one bills Gemini per call.
 */
export default async function AiCaloriePage() {
  const [locale, premium] = await Promise.all([getLocale(), hasPremiumAccess()]);

  if (!premium) return <AiWalkthrough locale={locale} />;

  return <CalorieAiClient locale={locale} />;
}

function AiWalkthrough({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader eyebrow={t(locale, "ai.title")} title={t(locale, "nav.scan")} />

      {/* One card for the three steps, rows divided by hairlines — the way
          Today groups a list, instead of three loose boxes. */}
      <section className="card-surface flex flex-col gap-1 p-5">
        <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{t(locale, "ai.how_title")}</h2>
        <p className="text-[15px] text-muted">{t(locale, "ai.subtitle")}</p>
        <ol className="mt-3 flex flex-col divide-y divide-hairline">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 py-3.5 first:pt-1 last:pb-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-[15px] font-semibold">{t(locale, title)}</p>
                <p className="text-[13px] leading-snug text-muted">{t(locale, body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="card-surface flex flex-col gap-4 p-5">
        <p className="text-[15px] font-semibold">{t(locale, "ai.premium_only")}</p>
        <Button asChild size="lg" className="w-full">
          <Link href="/checkout?from=ai">{t(locale, "ai.premium_cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
