import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { type LockedFeature } from "@/lib/access";
import { cn } from "@/lib/utils";

export const LOCK_REASON: Record<LockedFeature, StringKey> = {
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
      <p className="text-sm font-bold">{t(locale, LOCK_REASON[feature])}</p>
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
 * One card, listing everything a subscription adds.
 *
 * The dashboard used to render a separate `Locked` per paid control, and three
 * of them stacked read as a wall — the exact impression the free tier exists to
 * avoid. Per-control prompts belong where the user reached for something
 * specific; a screen they merely landed on gets one calm summary, placed after
 * the things they already own.
 */
export function UpgradeSummary({ locale }: { locale: Locale }) {
  const items: StringKey[] = ["up.i1", "up.i2", "up.i3", "up.i4"];
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-extrabold">{t(locale, "up.title")}</p>
      <p className="text-xs leading-relaxed text-muted">{t(locale, "up.body")}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {t(locale, key)}
          </li>
        ))}
      </ul>
      <Link
        href="/checkout"
        className="mt-1 w-max rounded-full bg-accent px-5 py-2.5 font-display text-sm font-bold text-bg transition-transform hover:-translate-y-0.5"
      >
        {t(locale, "lock.cta")}
      </Link>
    </div>
  );
}
