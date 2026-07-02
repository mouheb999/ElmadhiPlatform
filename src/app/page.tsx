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
      <Logo className="h-20 w-20 sm:h-24 sm:w-24" wordmarkClassName="text-3xl sm:text-4xl" />
      <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
        {t(locale, "home.hero")}
      </h1>
      <p className="max-w-md text-balance text-muted">{t(locale, "home.sub")}</p>
      <Button size="lg" asChild>
        <Link href="/login">{t(locale, "home.cta")}</Link>
      </Button>
    </main>
  );
}
