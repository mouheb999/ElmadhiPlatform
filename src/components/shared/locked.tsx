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
 * The same six reasons as the app states them.
 *
 * The previous step dropped the per-feature line inside the app and showed one
 * generic "this is for members" instead, on the grounds that every web line
 * ends in "part of the full plan" — a plan the app cannot sell. Naming the
 * feature is better, though, and the dashboard now needs it: a redirect that
 * lands with `?locked=progress` should say Progress, not "something". So the
 * lines are kept and reworded rather than dropped.
 */
export const LOCK_REASON_APP: Record<LockedFeature, StringKey> = {
  session: "lock.session_app",
  meal_log: "lock.meal_log_app",
  checkin: "lock.checkin_app",
  progress: "lock.progress_app",
  ai: "lock.ai_app",
  qa: "lock.qa_app",
};

/**
 * The strings and the destination that differ between the web's wall and the
 * app's, resolved in one place.
 *
 * Three components render this wall — the card, the dialog and the dashboard
 * summary — and all three had the price-bearing copy and the /checkout link
 * written into them inline. Inside the Android app every one of those is a Play
 * policy problem, so the choice is made here once instead of three times.
 *
 * On the web nothing changes: same title, same per-feature reason, same "stays
 * free" note, same "See plans" button pointing at /checkout with the `from=`
 * vocabulary checkout already reads.
 *
 * In the app the per-feature reason is reworded, not dropped — see
 * LOCK_REASON_APP. Every web line ends in "part of the full plan", which inside
 * an app that cannot sell a plan is both a policy risk and a non-sequitur: it
 * advertises something the reader has no way to buy. The app says "for members"
 * instead, keeps the "stays free" note off entirely, and sends the button to
 * /support — already always-free in the proxy, precisely so a locked-out
 * account can reach a human.
 */
export function lockCopy(
  feature: LockedFeature,
  appShell: boolean,
): {
  title: StringKey;
  body: StringKey;
  note: StringKey | null;
  cta: StringKey;
  href: string;
} {
  if (appShell) {
    return {
      title: "lock.title_app",
      body: LOCK_REASON_APP[feature],
      // No "stays free" line: in the app there is no paid/free split to
      // explain, only a door and a person to ask.
      note: null,
      cta: "lock.cta_app",
      href: "/support",
    };
  }
  return {
    title: "lock.title",
    body: LOCK_REASON[feature],
    note: "lock.free_note",
    cta: "lock.cta",
    href: `/checkout?from=${feature}`,
  };
}

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
  appShell = false,
  className,
}: {
  locale: Locale;
  feature: LockedFeature;
  /**
   * Render the Android app's version: no price, no plan, no /checkout. See
   * `lockCopy` for what changes and why.
   */
  appShell?: boolean;
  className?: string;
}) {
  const copy = lockCopy(feature, appShell);
  return (
    <div
      className={cn(
        "card-surface flex flex-col gap-3 p-5",
        className,
      )}
    >
      <span className="flex w-max items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold tracking-normalr text-accent">
        <Lock className="h-3 w-3" />
        {t(locale, copy.title)}
      </span>
      <p className="text-sm font-bold">{t(locale, copy.body)}</p>
      {copy.note && <p className="text-xs text-muted">{t(locale, copy.note)}</p>}
      <Link
        href={copy.href}
        className="mt-1 w-max rounded-full bg-accent px-5 py-2.5 font-display text-sm font-bold text-bg transition-transform hover:-translate-y-0.5"
      >
        {t(locale, copy.cta)}
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
export function UpgradeSummary({
  locale,
  appShell = false,
}: {
  locale: Locale;
  /** The app's wording: no price, and "Contact us" instead of "See plans". */
  appShell?: boolean;
}) {
  // The four bullets are the same either way — they describe features, not
  // prices, which is exactly what this card is for.
  const items: StringKey[] = ["up.i1", "up.i2", "up.i3", "up.i4"];
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-extrabold">{t(locale, appShell ? "up.title_app" : "up.title")}</p>
      <p className="text-xs leading-relaxed text-muted">
        {t(locale, appShell ? "up.body_app" : "up.body")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {t(locale, key)}
          </li>
        ))}
      </ul>
      <Link
        href={appShell ? "/support" : "/checkout"}
        className="mt-1 w-max rounded-full bg-accent px-5 py-2.5 font-display text-sm font-bold text-bg transition-transform hover:-translate-y-0.5"
      >
        {t(locale, appShell ? "lock.cta_app" : "lock.cta")}
      </Link>
    </div>
  );
}
