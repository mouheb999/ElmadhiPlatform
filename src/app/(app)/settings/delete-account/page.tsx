import { AlertTriangle } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t, type StringKey } from "@/lib/i18n";
import { getSubscription } from "@/lib/subscription-server";
import { PageHeader } from "@/components/shared/page-header";
import { DeleteAccountButton } from "./delete-account-button";

export const dynamic = "force-dynamic";

const ITEMS: StringKey[] = [
  "account.delete_item_profile",
  "account.delete_item_training",
  "account.delete_item_food",
  "account.delete_item_messages",
];

/**
 * Settings → Delete account.
 *
 * Both stores require this inside the app (Google Play's data-deletion policy,
 * App Store rule 5.1.1(v)), and both want it easy to find and to understand.
 * So the screen says plainly what goes, that it is immediate, and — for a
 * paying member — that the time left on their subscription goes with it,
 * before the one red button. The button opens a confirm sheet; nothing is
 * deleted on the first tap.
 */
export default async function DeleteAccountPage() {
  const [locale, subscription] = await Promise.all([getLocale(), getSubscription()]);

  const expiry =
    subscription.active && subscription.plan_expires_at
      ? new Intl.DateTimeFormat(locale === "tn" ? "ar-TN" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Africa/Tunis",
        }).format(new Date(subscription.plan_expires_at))
      : null;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageHeader title={t(locale, "account.delete_title")} />

      <section className="card-surface flex flex-col gap-4 p-5">
        <p className="text-[17px] font-semibold leading-snug">{t(locale, "account.delete_intro")}</p>

        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-subtle">
            {t(locale, "account.delete_what")}
          </h2>
          <ul className="mt-2 flex flex-col divide-y divide-hairline">
            {ITEMS.map((key) => (
              <li key={key} className="flex items-center gap-3 py-2.5 text-[15px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
                {t(locale, key)}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[15px] text-muted">{t(locale, "account.delete_when")}</p>
      </section>

      {expiry && (
        <p className="flex items-start gap-3 rounded-2xl bg-danger/[0.12] px-4 py-3.5 text-[15px]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          {t(locale, "account.delete_sub_warning").replace("{date}", expiry)}
        </p>
      )}

      <DeleteAccountButton locale={locale} />
    </div>
  );
}
