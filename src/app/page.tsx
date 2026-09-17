import Link from "next/link";
import { AttributionCapture } from "@/components/funnel/attribution-capture";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function Home() {
  const locale = await getLocale();
  return (
    <main className="container-page relative flex min-h-dvh flex-col items-center justify-center gap-8 py-16 text-center">
      {/* An ad can be pointed at this page as easily as at /start, and the
          campaign parameters survive one page load. Renders nothing. */}
      <AttributionCapture />

      <div className="glow-accent pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]" />
      <Logo className="h-20 sm:h-24" />
      <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
        {t(locale, "home.hero")}
      </h1>
      <p className="max-w-md text-balance text-muted">{t(locale, "home.sub")}</p>

      {/* Into the funnel, not at the price.
          /start asks eleven questions and hands back a plan built from the
          answers — calories, macros, a training week and the date the target
          lands on. Somebody who has watched that get built has a reason to
          read a price; somebody sent straight to /checkout is being asked to
          want a subscription to a product they have not seen.

          /checkout stays one tap away below for the reader who is already
          decided, and someone already subscribed who lands there still gets
          the "you're in" card. */}
      <Button size="lg" asChild>
        <Link href="/start">{t(locale, "fn.hero_cta")}</Link>
      </Button>

      <p className="-mt-3 flex flex-col gap-2 text-sm text-muted">
        <Link href="/checkout" className="font-bold text-ink hover:underline">
          {t(locale, "home.cta")}
        </Link>
        <span>
          {t(locale, "login.have_account")}{" "}
          <Link href="/login" className="font-bold text-accent hover:underline">
            {t(locale, "login.sign_in_link")}
          </Link>
        </span>
      </p>
    </main>
  );
}
