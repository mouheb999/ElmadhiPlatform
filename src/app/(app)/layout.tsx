import { Suspense } from "react";
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
import { AdminCopyBar } from "@/components/admin/copy-bar";
import { getSubscription } from "@/lib/subscription-server";

export const dynamic = "force-dynamic";

/**
 * The unread dot on the support icon.
 *
 * Its own component, suspended, for one reason: the shell must not await it.
 * Awaited inline in the layout, this single query sat in front of `{children}`
 * on every screen in the app — Dashboard, Diet, Workout, Q&A, Settings all
 * waited for a decorative dot before their own queries could even start.
 * Suspended, the shell streams immediately and the dot arrives whenever it
 * arrives. It still fails closed to "no dot" if migration 034 hasn't been
 * applied yet.
 */
async function SupportUnreadDot({ userId }: { userId: string }) {
  const supabase = await createClient();
  const unread = await countUnreadSupportReplies(supabase, userId);
  if (unread === 0) return null;

  return (
    <span
      aria-hidden
      className="absolute end-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent"
    />
  );
}

/**
 * Shell for every signed-in pillar route (/dashboard, /diet, /workout, /qa,
 * /settings). `proxy.ts` already gates auth + payment_status before this
 * layout ever renders; the check here is defense-in-depth for direct
 * server-side rendering, not the primary gate. `getCurrentUser` is
 * request-deduped, so the page rendering inside this layout reuses the same
 * verification rather than repeating it.
 *
 * Nothing else may be awaited here. Whatever this function waits on, every
 * screen in the app waits on too.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale, subscription] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    // Already request-cached and already read for the paywall, so asking who is
    // an admin here costs nothing extra.
    getSubscription(),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-bg/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <Logo className="h-7" />
        <div className="flex items-center gap-1">
          <Link
            href="/support"
            aria-label={t(locale, "support.title")}
            title={t(locale, "support.title")}
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"
          >
            <LifeBuoy className="h-5 w-5" />
            <Suspense fallback={null}>
              <SupportUnreadDot userId={user.id} />
            </Suspense>
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

      {subscription.is_admin && <AdminCopyBar locale={locale} />}
    </div>
  );
}
