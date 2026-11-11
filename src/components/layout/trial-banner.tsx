import Link from "next/link";
import { isAppShell } from "@/lib/app-shell";
import { t, type Locale } from "@/lib/i18n";
import {
  freeAccessDaysLeft,
  hasPaidTerm,
  type SubscriptionProfile,
} from "@/lib/subscription";

/**
 * How long the free days have left, on every screen of the app.
 *
 * A trial that ends without warning ends as a locked door: the account worked
 * yesterday, and today every tap lands on a price. The person on the other
 * side of that has no idea a clock was running, and reads it as the app
 * breaking rather than as the moment to pay.
 *
 * So the clock is visible from the first screen, and the way to stop it is
 * beside it. It is deliberately a strip and not a modal — nobody should have
 * to dismiss a sales message to log their lunch — and it says the same thing
 * on day one as on day three, so it is information rather than pressure.
 *
 * Renders nothing for a paying customer, an admin, or an account with no
 * window open (which the paywall has already sent elsewhere).
 *
 * Suspended by the layout, because it asks whether this is the store app and
 * the shell must not wait on that. Inside the iPhone and Android apps the
 * link is left out: /checkout is closed there by store policy, and a button
 * that goes nowhere is worse than a sentence that says how long is left.
 */
export async function TrialBanner({
  locale,
  subscription,
}: {
  locale: Locale;
  subscription: SubscriptionProfile;
}) {
  if (subscription.is_admin || hasPaidTerm(subscription)) return null;
  const daysLeft = freeAccessDaysLeft(subscription);
  if (daysLeft === null) return null;

  const appShell = await isAppShell();
  // A request is open: they have started paying, so the action is to finish
  // it, not to be shown the plans again.
  const paying = subscription.payment_status === "pending";

  return (
    <div className="container-page pt-1">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-[13px] leading-snug">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="truncate">
            <span className="font-bold text-ink">{t(locale, "trial.label")}</span>
            <span className="text-muted">
              {" · "}
              {t(locale, daysLeft === 1 ? "trial.left_one" : "trial.left_many").replace(
                "{n}",
                String(daysLeft),
              )}
            </span>
          </span>
        </p>
        {!appShell && (
          <Link
            href="/checkout"
            className="press shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-bold text-bg"
          >
            {t(locale, paying ? "trial.finish_payment" : "trial.subscribe")}
          </Link>
        )}
      </div>
    </div>
  );
}
