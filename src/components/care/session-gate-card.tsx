import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { hasCondition, onInsulin, type ClinicalProfile } from "@/lib/clinical/types";
import { judgeBloodPressure, judgeGlucose, type Readiness } from "@/lib/clinical/gates";
import type { DayPlan } from "@/lib/clinical/schedule";
import { careText } from "./care-text";
import { GateBanner } from "./care-panels";
import { ReadingsCard } from "./readings-card";

/**
 * What stands in front of the session when the care layer says no.
 *
 * It does not just refuse. Two of the three things that block a session — an
 * untaken sugar and an untaken blood pressure — are cleared by taking them,
 * so the card carries the inputs for both: he lands here, measures, and the
 * page re-renders into the session. A refusal that made him navigate to
 * another screen and back would be the version of this that gets ignored.
 *
 * The one it cannot clear is the day type. There is no input for "actually
 * today is fine", by design.
 */
export function SessionGateCard({
  locale,
  profile,
  readiness,
  today,
  timingBlocked,
  timingReasonKey,
  nextTraining,
  glucoseMgdl,
  bp,
}: {
  locale: Locale;
  profile: ClinicalProfile;
  readiness: Readiness;
  today: DayPlan;
  timingBlocked: boolean;
  timingReasonKey: string;
  nextTraining: DayPlan | null;
  glucoseMgdl: number | null;
  bp: { systolic: number; diastolic: number } | null;
}) {
  const glucoseReasonKey =
    glucoseMgdl !== null ? judgeGlucose(profile, glucoseMgdl).reasonKey : null;
  const bpReasonKey = bp !== null ? judgeBloodPressure(profile, bp.systolic, bp.diastolic).reasonKey : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-red-300">
          <ShieldAlert className="h-6 w-6" />
          {t(locale, "care.blocked_title")}
        </h1>
        <p className="text-sm text-muted">{careText(locale, today.reasonKey)}</p>
      </header>

      <GateBanner
        locale={locale}
        readiness={readiness}
        timingBlockedReasonKey={timingBlocked ? timingReasonKey : null}
      />

      {/* Only worth rendering when a reading is what is missing — on a dialysis
          day the numbers change nothing, and offering them would imply they might. */}
      {!timingBlocked && (
        <ReadingsCard
          locale={locale}
          unit={profile.glucoseDisplayUnit}
          needsGlucose={onInsulin(profile)}
          needsBp={hasCondition(profile, "hypertension")}
          glucoseMgdl={glucoseMgdl}
          bp={bp}
          glucoseReasonKey={glucoseReasonKey}
          bpReasonKey={bpReasonKey}
        />
      )}

      {timingBlocked && nextTraining && (
        <p className="rounded-card border border-hairline bg-surface p-4 text-sm">
          <span className="text-muted">{t(locale, "care.next_window")}: </span>
          <span className="font-bold">{nextTraining.dateKey}</span>
        </p>
      )}

      <Link
        href="/care"
        className="text-center text-sm font-bold text-accent hover:underline"
      >
        {t(locale, "care.open_care")} →
      </Link>
    </div>
  );
}
