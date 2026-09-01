import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Info,
  ListChecks,
  ShieldAlert,
  Stethoscope,
  Timer,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import type { Blocker, Readiness, SessionShape, AccessRestriction } from "@/lib/clinical/gates";
import type { ProgressionDecision } from "@/lib/clinical/progression";
import type { RenalPlan } from "@/lib/clinical/load";
import { careText } from "./care-text";

/**
 * The read-only halves of the care screen. Server components: none of these
 * take input, so none of them need to ship JavaScript.
 */

const WHO_LABELS: Record<string, StringKey> = {
  orthopedist: "care.who_orthopedist",
  cardiologist: "care.who_cardiologist",
  diabetologist: "care.who_diabetologist",
  dialysis_unit: "care.who_dialysis_unit",
};

/**
 * Why he cannot start, or what to keep in mind if he can.
 *
 * Blockers and warnings are visually different on purpose. A blocker is red
 * and ends the question; a warning is amber and narrows the session without
 * stopping it. Merging them into one list of "issues" would put "your legs are
 * on hold" next to "your sugar is too low to train" in the same grey type.
 */
export function GateBanner({
  locale,
  readiness,
  timingBlockedReasonKey,
  className,
}: {
  locale: Locale;
  readiness: Readiness;
  /** From `canTrainAt` — the day-type rule, which is asked separately. */
  timingBlockedReasonKey: string | null;
  className?: string;
}) {
  const blockers: Blocker[] = [
    ...(timingBlockedReasonKey
      ? [{ key: timingBlockedReasonKey, level: "blocked" as const, waitingOn: null }]
      : []),
    ...readiness.blockers,
  ];

  if (blockers.length === 0 && readiness.warnings.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {blockers.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-red-400/30 bg-red-400/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-red-300">
            <ShieldAlert className="h-4 w-4" />
            {t(locale, "care.blocked_title")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {blockers.map((blocker) => (
              <li key={blocker.key} className="text-sm text-ink/90">
                {careText(locale, blocker.key)}
                {blocker.waitingOn && (
                  <span className="text-muted"> · {t(locale, WHO_LABELS[blocker.waitingOn])}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {readiness.warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-amber-400/30 bg-amber-400/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {t(locale, "care.warnings_title")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {readiness.warnings.map((warning) => (
              <li key={warning.key} className="text-sm text-ink/90">
                {careText(locale, warning.key)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The outstanding letters, as a job list.
 *
 * This is the most valuable panel on the screen for the coach: it is the exact
 * set of questions to walk into the next appointment with, and it empties
 * itself as the answers arrive.
 */
export function ClearancesCard({
  locale,
  outstanding,
}: {
  locale: Locale;
  outstanding: { waitingOn: string; reasonKey: string }[];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <ListChecks className="h-5 w-5 text-accent" />
        {t(locale, "care.clearances_title")}
      </h2>

      {outstanding.length === 0 ? (
        <p className="text-sm text-muted">{t(locale, "care.clearances_none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {outstanding.map((item) => (
            <li key={item.reasonKey} className="flex gap-3">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="flex flex-col">
                <span className="text-sm font-bold">{t(locale, WHO_LABELS[item.waitingOn])}</span>
                <span className="text-sm text-muted">{careText(locale, item.reasonKey)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link href="/care/file" className="text-sm font-bold text-accent hover:underline">
        {t(locale, "care.file_title")} →
      </Link>
    </section>
  );
}

/** How a session runs: the caps, and the sentence that says they are stops. */
export function ShapeCard({
  locale,
  shape,
  access,
}: {
  locale: Locale;
  shape: SessionShape;
  access: AccessRestriction;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Timer className="h-5 w-5 text-accent" />
        {t(locale, "care.shape_title")}
      </h2>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label={t(locale, "care.shape_minutes")} value={`${shape.minMinutes}–${shape.maxMinutes} min`} />
        <Stat label={t(locale, "care.shape_rest")} value={`${shape.restSecondsMin}s+`} />
        <Stat
          label={t(locale, "care.shape_effort")}
          value={`${shape.effortCeiling} ${t(locale, "care.shape_effort_value")}`}
        />
        {shape.seatedOnly && (
          <Stat label={t(locale, "care.shape_seated")} value={t(locale, "care.adherence_on_plan")} />
        )}
      </dl>

      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-ink/90">
        {t(locale, "care.hard_stop")}
      </p>
      <p className="text-sm text-muted">{careText(locale, shape.gate.reasonKey)}</p>

      {(access.loadWarning || access.cuffWarning) && (
        <p className="flex gap-2 text-sm text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {careText(locale, access.reasonKey)}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

/** Where the program goes next, and the reminder that it never goes up in weight. */
export function ProgressionCard({
  locale,
  decision,
}: {
  locale: Locale;
  decision: ProgressionDecision;
}) {
  const alarming = decision.step === "stop_and_review";
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-card border p-5",
        alarming ? "border-red-400/40 bg-red-400/10" : "border-hairline bg-surface",
      )}
    >
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <TrendingUp className="h-5 w-5 text-accent" />
        {t(locale, "care.prog_title")}
      </h2>
      <p className={cn("text-base font-extrabold", alarming && "text-red-300")}>
        {t(locale, `care.step_${decision.step}` as StringKey)}
      </p>
      <p className="text-sm text-muted">{careText(locale, decision.reasonKey)}</p>
      {decision.triggeredBy.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {decision.triggeredBy.map((symptom) => (
            <span
              key={symptom}
              className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-bold"
            >
              {t(locale, `care.sym_${symptom}` as StringKey)}
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-muted">{t(locale, "care.prog_not_load")}</p>
    </section>
  );
}

/**
 * The dietitian's plan, displayed.
 *
 * Every number on this card came off a document somebody else wrote. The
 * footnote saying so is not decoration — it is the difference between a
 * renal diet the app is relaying and one it appears to be prescribing.
 */
export function RenalPlanCard({ locale, plan }: { locale: Locale; plan: RenalPlan | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Utensils className="h-5 w-5 text-accent" />
        {t(locale, "care.plan_title")}
      </h2>

      {!plan ? (
        <p className="text-sm text-muted">{t(locale, "care.plan_none")}</p>
      ) : (
        <>
          {plan.dietitianName && (
            <p className="text-sm text-muted">
              {t(locale, "care.plan_by")} {plan.dietitianName}
              {plan.issuedOn && ` · ${plan.issuedOn}`}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {plan.calories !== null && (
              <Stat label={t(locale, "care.plan_calories")} value={`${plan.calories} kcal`} />
            )}
            {plan.proteinG !== null && (
              <Stat label={t(locale, "care.plan_protein")} value={`${plan.proteinG} g`} />
            )}
            {plan.sodiumMg !== null && (
              <Stat label={t(locale, "care.plan_sodium")} value={`${plan.sodiumMg} mg`} />
            )}
            {plan.potassiumMg !== null && (
              <Stat label={t(locale, "care.plan_potassium")} value={`${plan.potassiumMg} mg`} />
            )}
            {plan.phosphorusMg !== null && (
              <Stat label={t(locale, "care.plan_phosphorus")} value={`${plan.phosphorusMg} mg`} />
            )}
            {plan.fluidMlPerDay !== null && (
              <Stat label={t(locale, "care.plan_fluid")} value={`${plan.fluidMlPerDay} ml`} />
            )}
          </dl>

          {plan.meals.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t(locale, "care.plan_meals")}</h3>
              <ul className="flex flex-col gap-2">
                {plan.meals.map((meal, index) => (
                  <li
                    key={`${meal.time ?? "meal"}-${index}`}
                    className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
                  >
                    {meal.time && <span className="font-mono text-muted">{meal.time}</span>}
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {(locale === "tn" ? meal.labelAr : meal.labelEn) ?? meal.labelEn ?? ""}
                      </span>
                      {meal.portions && <span className="text-muted">{meal.portions}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.notes && <p className="text-sm text-ink/90">{plan.notes}</p>}

          {plan.documentPath && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <FileText className="h-4 w-4" />
              {plan.documentPath.split("/").pop()}
            </p>
          )}
        </>
      )}

      <p className="text-xs text-muted">{t(locale, "care.plan_not_ours")}</p>
    </section>
  );
}
