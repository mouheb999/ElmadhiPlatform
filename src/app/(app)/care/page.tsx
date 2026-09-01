import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { tunisDateKey } from "@/lib/dates";
import { loadCareState } from "@/lib/clinical/load";
import { judgeBloodPressure, judgeGlucose } from "@/lib/clinical/gates";
import { hasCondition, onInsulin } from "@/lib/clinical/types";
import { WeekStrip } from "@/components/care/week-strip";
import { ReadingsCard } from "@/components/care/readings-card";
import { FluidCard } from "@/components/care/fluid-card";
import { AdherenceCard } from "@/components/care/adherence-card";
import { SymptomCard } from "@/components/care/symptom-card";
import {
  ClearancesCard,
  GateBanner,
  ProgressionCard,
  RenalPlanCard,
  ShapeCard,
} from "@/components/care/care-panels";

export const dynamic = "force-dynamic";

/**
 * The Care screen.
 *
 * Ordered by what a tired person needs first: what today is, whether he may
 * train, the two checks, then the things that are true all week — the session
 * caps, the dietitian's plan, the fluid count — and last the two panels that
 * are really for the coach: what the program does next, and which letters are
 * still missing.
 *
 * An account with no clinical profile never gets here: `/care/file` is where a
 * file is started, and the nav item only appears once one exists.
 */
export default async function CarePage() {
  const [supabase, locale, user] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrentUser(),
  ]);

  const state = await loadCareState(supabase, user!.id);
  if (!state.profile) redirect("/care/file");

  const todayKey = tunisDateKey();
  const glucoseReasonKey =
    state.todayGlucoseMgdl !== null
      ? judgeGlucose(state.profile, state.todayGlucoseMgdl).reasonKey
      : null;
  const bpReasonKey =
    state.todayBp !== null
      ? judgeBloodPressure(state.profile, state.todayBp.systolic, state.todayBp.diastolic).reasonKey
      : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
          <HeartPulse className="h-7 w-7 text-accent" />
          {t(locale, "care.title")}
        </h1>
        <p className="text-sm text-muted">{t(locale, "care.subtitle")}</p>
      </header>

      <section className="rounded-card border border-hairline bg-surface p-5">
        <WeekStrip locale={locale} week={state.week} todayKey={todayKey} />
      </section>

      <GateBanner
        locale={locale}
        readiness={state.readiness}
        timingBlockedReasonKey={state.timing.allowed ? null : state.timing.reasonKey}
      />

      <ReadingsCard
        locale={locale}
        unit={state.profile.glucoseDisplayUnit}
        needsGlucose={onInsulin(state.profile)}
        needsBp={hasCondition(state.profile, "hypertension")}
        glucoseMgdl={state.todayGlucoseMgdl}
        bp={state.todayBp}
        glucoseReasonKey={glucoseReasonKey}
        bpReasonKey={bpReasonKey}
      />

      <ShapeCard locale={locale} shape={state.shape} access={state.access} />

      {hasCondition(state.profile, "dialysis") && (
        <>
          <FluidCard
            locale={locale}
            totalMl={state.fluidTodayMl}
            allowanceMl={state.renalPlan?.fluidMlPerDay ?? null}
          />
          <RenalPlanCard locale={locale} plan={state.renalPlan} />
          <AdherenceCard locale={locale} current={state.adherenceToday} />
        </>
      )}

      <SymptomCard locale={locale} />

      <ProgressionCard locale={locale} decision={state.progression} />

      <ClearancesCard locale={locale} outstanding={state.outstanding} />

      <Link
        href="/care/file"
        className="text-center text-sm font-bold text-muted hover:text-ink"
      >
        {t(locale, "care.file_title")}
      </Link>
    </div>
  );
}
