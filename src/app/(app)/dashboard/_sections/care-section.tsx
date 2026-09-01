import Link from "next/link";
import { ChevronRight, HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { loadCareState } from "@/lib/clinical/load";
import type { DayType } from "@/lib/clinical/schedule";
import { careText } from "@/components/care/care-text";

/**
 * The care headline on Today.
 *
 * Suspended and self-contained, like the nutrition and Q&A sections: it owns
 * seven queries of its own, and the rest of the dashboard has no reason to
 * wait for them.
 *
 * It renders NOTHING for an account with no clinical profile — which is almost
 * every account. The care layer is invisible until somebody starts a file.
 */

const DAY_LABELS: Record<DayType, StringKey> = {
  dialysis: "care.day_dialysis",
  recovery: "care.day_recovery",
  training: "care.day_training",
  unknown: "care.day_unknown",
};

const DAY_STYLES: Record<DayType, string> = {
  dialysis: "border-amber-400/30 bg-amber-400/10",
  recovery: "border-white/10 bg-white/[0.03]",
  training: "border-accent/30 bg-accent/10",
  unknown: "border-dashed border-white/20 bg-transparent",
};

export async function CareSection({ locale, userId }: { locale: Locale; userId: string }) {
  const supabase = await createClient();
  const state = await loadCareState(supabase, userId);
  if (!state.profile) return null;

  const today = state.today;
  const blocked = !state.timing.allowed || !state.readiness.allowed;
  // The most useful single line: why he cannot start, if he cannot; otherwise
  // what kind of day this is.
  const headlineKey = !state.timing.allowed
    ? state.timing.reasonKey
    : state.readiness.blockers[0]?.key ?? today.reasonKey;

  return (
    <Link
      href="/care"
      className={cn(
        "flex items-center gap-3 rounded-card border p-4 transition-colors hover:bg-white/5",
        DAY_STYLES[today.type],
      )}
    >
      <HeartPulse className="h-6 w-6 shrink-0 text-accent" />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold">
          {t(locale, DAY_LABELS[today.type])}
          {blocked && <span className="text-red-300"> · {t(locale, "care.blocked_title")}</span>}
        </span>
        <span className="truncate text-xs text-muted">{careText(locale, headlineKey)}</span>
      </div>
      <ChevronRight className="ms-auto h-5 w-5 shrink-0 text-muted rtl:rotate-180" />
    </Link>
  );
}

/** Same height as the card it stands in for, so Today does not jump. */
export function CareSectionSkeleton() {
  return <div className="h-[4.5rem] w-full animate-pulse rounded-card bg-surface" aria-hidden />;
}
