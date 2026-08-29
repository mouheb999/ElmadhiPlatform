import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function Home() {
  const locale = await getLocale();
  return (
    <main className="container-page relative flex min-h-dvh flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="glow-accent pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]" />
      <Logo className="h-20 sm:h-24" />
      <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
        {t(locale, "home.hero")}
      </h1>
      <p className="max-w-md text-balance text-muted">{t(locale, "home.sub")}</p>
      {/* Straight to the product, not to a form.
          /checkout is the sales page — the walkable preview of the app, the
          plans, the prices — and it is reachable signed out. Pointing the only
          button on this page at /login put an account form in front of the one
          screen built to convince somebody they want an account, which is the
          mistake the whole funnel rework exists to undo. Someone already active
          who lands here gets the "you're in" card on /checkout, so this is safe
          for returning customers too. */}
      <Button size="lg" asChild>
        <Link href="/checkout">{t(locale, "home.cta")}</Link>
      </Button>

      <p className="-mt-3 text-sm text-muted">
        {t(locale, "login.have_account")}{" "}
        <Link href="/login" className="font-bold text-accent hover:underline">
          {t(locale, "login.sign_in_link")}
        </Link>
      </p>
    </main>
  );
}
