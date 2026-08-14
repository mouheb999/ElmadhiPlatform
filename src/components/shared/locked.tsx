import Link from "next/link";
import { Lock } from "lucide-react";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { type LockedFeature } from "@/lib/access";
import { cn } from "@/lib/utils";

const REASON: Record<LockedFeature, StringKey> = {
  session: "lock.session",
  meal_log: "lock.meal_log",
  checkin: "lock.checkin",
  progress: "lock.progress",
  ai: "lock.ai",
  qa: "lock.qa",
};

/**
 * What a free account sees where a paid control would be.
 *
 * Two things it deliberately does. It names the specific feature rather than
 * showing one generic "upgrade" everywhere, because "recording your sets is
 * part of the full plan" tells somebody what they are buying and "upgrade" does
 * not. And it repeats that the plan itself stays free, because the whole point
 * of the new funnel is that reaching this card is not the same as being locked
 * out of the product — a user who thinks they have hit a dead end leaves.
 */
export function Locked({
  locale,
  feature,
  className,
}: {
  locale: Locale;
  feature: LockedFeature;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-hairline bg-surface/60 p-5",
        className,
      )}
    >
      <span className="flex w-max items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
        <Lock className="h-3 w-3" />
        {t(locale, "lock.title")}
      </span>
      <p className="text-sm font-bold">{t(locale, REASON[feature])}</p>
      <p className="text-xs text-muted">{t(locale, "lock.free_note")}</p>
      <Link
        href={`/checkout?from=${feature}`}
        className="mt-1 w-max rounded-full bg-accent px-5 py-2.5 font-display text-sm font-bold text-bg transition-transform hover:-translate-y-0.5"
      >
        {t(locale, "lock.cta")}
      </Link>
    </div>
  );
}

/**
 * The free-account note on the plan screens — the counterpart to `Locked`. It
 * runs where nothing is blocked, to say so: somebody who just generated a
 * program should understand that reading it costs nothing before they ever meet
 * a locked control.
 */
export function FreePlanNote({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="text-sm font-bold">{t(locale, "free.title")}</p>
      <p className="text-xs leading-relaxed text-muted">{t(locale, "free.body")}</p>
      <Link
        href="/checkout"
        className="mt-1 text-sm font-bold text-accent hover:underline"
      >
        {t(locale, "lock.cta")} →
      </Link>
    </div>
  );
}
