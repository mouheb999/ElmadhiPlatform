import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t, type StringKey } from "@/lib/i18n";
import { LegalShell } from "@/components/legal/legal-shell";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Delete your account · HYPE FITNESS",
  description: "How to delete your HYPE FITNESS account and what is deleted.",
};

const ITEMS: StringKey[] = [
  "account.delete_item_profile",
  "account.delete_item_training",
  "account.delete_item_food",
  "account.delete_item_messages",
];

/**
 * Public account-deletion page.
 *
 * Google Play asks for a web link, outside the app, where people can find out
 * how to delete their account and what is deleted — this is it, and the URL to
 * put in Play Console. It is also where the in-app deletion lands afterwards
 * (`?done=1`), signed out, since the account it would belong to no longer
 * exists.
 */
export default async function DeleteAccountInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const [locale, { done }] = await Promise.all([getLocale(), searchParams]);
  const tn = locale === "tn";

  if (done === "1") {
    return (
      <LegalShell locale={locale} title={t(locale, "account.deleted_title")} showUpdated={false}>
        <section className="card-surface flex flex-col items-center gap-4 p-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-train/15 text-train">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <p className="text-[17px] leading-snug">{t(locale, "account.deleted_body")}</p>
        </section>
        <Link
          href="/login"
          className="press flex h-14 items-center justify-center rounded-full bg-surface2 text-[17px] font-semibold"
        >
          {tn ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </LegalShell>
    );
  }

  const steps = tn
    ? [
        "افتح تطبيق HYPE FITNESS، أو سجّل الدخول على hypefitness.club.",
        "اضغط على زر الحساب أعلى الشاشة لفتح الإعدادات.",
        "اختر «حذف الحساب» ثم أكّد.",
      ]
    : [
        "Open the HYPE FITNESS app, or sign in at hypefitness.club.",
        "Tap the account button at the top of the screen to open Settings.",
        "Choose “Delete account”, then confirm.",
      ];

  return (
    <LegalShell locale={locale} title={tn ? "حذف حسابك" : "Delete your account"}>
      <section className="card-surface flex flex-col gap-3 p-5">
        <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{tn ? "كيف" : "How"}</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="font-num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-bg">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card-surface flex flex-col gap-3 p-5">
        <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{t(locale, "account.delete_what")}</h2>
        <ul className="flex flex-col divide-y divide-hairline">
          {ITEMS.map((key) => (
            <li key={key} className="flex items-center gap-3 py-2.5 text-[15px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
              {t(locale, key)}
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-relaxed text-muted">
          {tn
            ? "يتم الحذف فوراً ولا يمكن التراجع عنه. بيانات تحليلات الاستعمال لا تُحذف تلقائياً؛ راسلنا لحذفها."
            : "Deletion is immediate and can't be undone. Usage analytics are not removed automatically; contact us to have them removed."}
        </p>
      </section>

      <Link
        href="/login?next=/settings/delete-account"
        className="press flex h-14 items-center justify-center rounded-full bg-danger text-[17px] font-semibold text-white"
      >
        {tn ? "سجّل الدخول لحذف حسابك" : "Sign in to delete your account"}
      </Link>

      <p className="text-center text-[13px] leading-relaxed text-muted">
        {/* The route for someone locked out of their account. Only shown once
            a contact address is configured — Play Console expects one. */}
        {PRIVACY_CONTACT_EMAIL &&
          (tn
            ? `لا تستطيع تسجيل الدخول؟ راسلنا على ${PRIVACY_CONTACT_EMAIL} من بريد حسابك. `
            : `Can’t sign in? Email ${PRIVACY_CONTACT_EMAIL} from your account’s address. `)}
        <Link href="/privacy" className="font-semibold text-accent">
          {tn ? "سياسة الخصوصية" : "Privacy policy"}
        </Link>
      </p>
    </LegalShell>
  );
}
