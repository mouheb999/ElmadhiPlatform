"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";
import { discardEmptySession } from "@/app/actions/sessions";

/**
 * Interstitial when the user opens day B while a session for day A is
 * still open: one workout at a time. Continue is the hero action; an
 * accidental (still empty) session can be discarded.
 */
export function SessionElsewhereCard({
  locale,
  openDayId,
  openDayName,
  openSessionId,
  startedAgo,
  canDiscard,
}: {
  locale: Locale;
  openDayId: string;
  openDayName: string;
  openSessionId: string;
  /** Pre-localized "3 hours" style distance, rendered as "Started · {x}". */
  startedAgo: string;
  canDiscard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await discardEmptySession(openSessionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15">
        <Dumbbell className="h-10 w-10 text-accent" />
      </div>
      <div>
        <h1 className="text-xl font-extrabold">{t(locale, "session.other_in_progress")}</h1>
        <p className="mt-2 text-sm text-muted">
          {openDayName} · {t(locale, "session.started_ago")} {startedAgo}
        </p>
      </div>
      <Button asChild className="w-full max-w-sm">
        <Link href={`/workout/session/${openDayId}`}>{t(locale, "session.continue")}</Link>
      </Button>
      {canDiscard && (
        <button
          type="button"
          onClick={discard}
          disabled={pending}
          className="flex items-center gap-2 text-sm font-bold text-muted transition-colors hover:text-red-400 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {t(locale, "session.discard")}
        </button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
