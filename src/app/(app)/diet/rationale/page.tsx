import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t, pick } from "@/lib/i18n";
import { RationaleCard } from "@/components/shared/rationale-card";
import { IntensityToggle } from "@/components/diet/intensity-toggle";
import { Button } from "@/components/ui/button";
import type { Goal } from "@/lib/algorithms/diet-strategy";
import type { Bilingual } from "@/lib/algorithms/diet-strategy";
import type { Json } from "@/types/db";

export const dynamic = "force-dynamic";

function asBilingual(value: unknown): Bilingual {
  const v = value as { en?: string; ar?: string } | undefined;
  return { en: v?.en ?? "", ar: v?.ar ?? "" };
}

export default async function DietRationalePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id, goal, diet_intensity")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!dietProfile) redirect("/diet/questions");

  const { data: macros } = await supabase
    .from("macro_targets")
    .select("*")
    .eq("diet_profile_id", dietProfile.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!macros) redirect("/diet/questions");

  const r = (macros.rationale_json ?? {}) as Record<string, Json>;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">
        {t(locale, "diet.rationale_title")}
      </h1>

      <RationaleCard
        headline={t(locale, "diet.rationale_bmr")}
        body={pick(locale, asBilingual(r.bmr).en, asBilingual(r.bmr).ar)}
      />
      <RationaleCard
        headline={t(locale, "diet.rationale_tdee")}
        body={pick(locale, asBilingual(r.tdee).en, asBilingual(r.tdee).ar)}
      />
      <RationaleCard
        headline={t(locale, "diet.rationale_target")}
        body={pick(locale, asBilingual(r.target).en, asBilingual(r.target).ar)}
        metric={{ value: `${macros.calories}`, label: "kcal" }}
        emphasis
      />
      <div className="grid grid-cols-3 gap-3">
        <RationaleCard headline={`${macros.protein_g}g`} body={pick(locale, asBilingual(r.protein).en, asBilingual(r.protein).ar)} />
        <RationaleCard headline={`${macros.carbs_g}g`} body={pick(locale, asBilingual(r.carbs).en, asBilingual(r.carbs).ar)} />
        <RationaleCard headline={`${macros.fat_g}g`} body={pick(locale, asBilingual(r.fat).en, asBilingual(r.fat).ar)} />
      </div>

      <IntensityToggle
        dietProfileId={dietProfile.id}
        goal={dietProfile.goal as Goal}
        currentIntensity={dietProfile.diet_intensity}
        locale={locale}
        warning={
          dietProfile.goal === "lose_fat"
            ? locale === "tn"
              ? "أسرع، لكن أصعب: طاقة أقل للتمرين، احتمال تخسر عضل أكثر، وما ينفعش تكمل فيه أكثر من شهرين تقريبًا."
              : "Faster, but harder: less training energy, higher risk of muscle loss, not meant to last more than ~2 months."
            : locale === "tn"
              ? "باش تزيد دهون أكثر، والتنشيف بعدها يكون أطول وأصعب."
              : "You'll gain noticeably more fat, and the cut afterward will be longer and harder."
        }
      />

      <Button asChild size="lg" className="mt-2">
        <Link href="/diet/plan">{t(locale, "diet.see_plan")}</Link>
      </Button>
    </div>
  );
}
