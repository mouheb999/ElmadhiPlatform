import { Logo } from "@/components/layout/logo";
import { BackButton } from "@/components/legal/back-button";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";
import type { Locale } from "@/lib/i18n";

/**
 * The frame for the public legal pages (/privacy, /delete-account).
 *
 * These live outside the signed-in app on purpose: the stores open them from
 * a listing, signed out, on the web, and the apps open them from Settings.
 * Same black page and flat cards as the app, so following the link from
 * Settings does not feel like leaving it.
 */
export function LegalShell({
  locale,
  title,
  children,
  showUpdated = true,
}: {
  locale: Locale;
  title: string;
  children: React.ReactNode;
  showUpdated?: boolean;
}) {
  const updated = new Intl.DateTimeFormat(locale === "tn" ? "ar-TN" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`));

  return (
    <div
      dir={locale === "tn" ? "rtl" : "ltr"}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[calc(env(safe-area-inset-top)+16px)]"
    >
      <div className="flex items-center justify-between">
        <BackButton label={locale === "tn" ? "رجوع" : "Back"} />
        <Logo className="h-7 w-auto" />
        <span className="w-10" aria-hidden />
      </div>
      <header>
        {showUpdated && (
          <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-subtle">
            {locale === "tn" ? `آخر تحديث: ${updated}` : `Last updated ${updated}`}
          </p>
        )}
        <h1 className="mt-0.5 text-[34px] font-extrabold leading-tight tracking-[-0.025em]">{title}</h1>
      </header>
      {children}
    </div>
  );
}
