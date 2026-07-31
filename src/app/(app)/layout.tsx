import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LifeBuoy } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { countUnreadSupportReplies } from "@/lib/support";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";

export const dynamic = "force-dynamic";

/**
 * Shell for every signed-in pillar route (/dashboard, /diet, /workout, /qa,
 * /settings). `proxy.ts` already gates auth + payment_status before this
 * layout ever renders; the check here is defense-in-depth for direct
 * server-side rendering, not the primary gate. `getCurrentUser` is
 * request-deduped, so the page rendering inside this layout reuses the same
 * verification rather than repeating it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) redirect("/login");

  // The support badge is the only per-request read this shell does. It fails
  // closed to "no dot" if migration 034 hasn't been applied yet.
  const supabase = await createClient();
  const unreadSupport = await countUnreadSupportReplies(supabase, user.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-bg/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <Logo className="h-9 w-9" wordmarkClassName="text-base" />
        <div className="flex items-center gap-1">
          <Link
            href="/support"
            aria-label={t(locale, "support.title")}
            title={t(locale, "support.title")}
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"
          >
            <LifeBuoy className="h-5 w-5" />
            {unreadSupport > 0 && (
              <span
                aria-hidden
                className="absolute end-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent"
              />
            )}
          </Link>
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="container-page flex-1 py-6 pb-28">{children}</main>

      <AppBottomNav locale={locale} />
    </div>
  );
}
