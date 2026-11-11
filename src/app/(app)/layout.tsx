import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircleQuestion, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { countUnreadSupportReplies } from "@/lib/support";
import { t } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { TrialBanner } from "@/components/layout/trial-banner";
import { AppHintsLoader } from "@/components/layout/app-hints-loader";
import { RouteTransition } from "@/components/layout/route-transition";
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
      className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-bg bg-danger"
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
      {/* `app-chrome`: the header is chrome. A long press on the logo raising
          text-selection handles is one of the clearest tells that an app is a
          web page in a shell. Content inside <main> stays selectable.

          Translucent rather than opaque, so content scrolling up under it shows
          through a blur the way a native navigation bar does. Pinned out of
          screen transitions (viewTransitionName) so it holds still while the
          content changes beneath it. */}
      <header
        style={{ viewTransitionName: "app-header" }}
        className="app-chrome sticky top-0 z-30 flex items-center justify-between bg-[rgba(0,0,0,0.72)] px-5 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-xl backdrop-saturate-[1.8]"
      >
        {/* The logo stays exactly as it is — the redesign changes the frame
            around the brand, never the brand. */}
        <Logo className="h-7" />
        <div className="flex items-center gap-2.5">
          {/* Two controls, native-style: the library, and an account button.
              Support and Settings live behind the account button now; the
              unread-reply dot moved onto it so a support answer is still
              impossible to miss. Settings has to stay one tap away from every
              screen: it holds the only sign-out button in the product, which is
              also why `proxy.ts` never paywalls it. */}
          <Link
            href="/qa"
            transitionTypes={["nav-forward"]}
            aria-label={t(locale, "qa.title")}
            className="press grid h-10 w-10 place-items-center rounded-full bg-surface2"
          >
            <MessageCircleQuestion className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <Link
            href="/settings"
            transitionTypes={["nav-forward"]}
            aria-label={`${t(locale, "settings.title")} · ${t(locale, "support.title")}`}
            className="press relative grid h-10 w-10 place-items-center rounded-full bg-surface2"
          >
            <UserRound className="h-5 w-5" strokeWidth={1.9} />
            <Suspense fallback={null}>
              <SupportUnreadDot userId={user.id} />
            </Suspense>
          </Link>
          {/* A notifications bell used to sit here. It was wired to nothing —
              it took a tap and did nothing, on every screen in the product.
              Removed rather than stubbed: a control that visibly does nothing
              teaches people that controls here might not work. */}
        </div>
      </header>

      <OfflineBanner locale={locale} />

      {/* Suspended for the same reason as the unread dot: it reads a header to
          learn whether this is the store app, and the shell does not wait. */}
      <Suspense fallback={null}>
        <TrialBanner locale={locale} subscription={subscription} />
      </Suspense>

      <main className="container-page flex-1 pt-2 pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        <RouteTransition>{children}</RouteTransition>
      </main>

      {/* The two one-time pointers. Suspended: nothing here may hold up the
          shell, and for a member who has dismissed both this resolves to
          nothing without a query. */}
      <Suspense fallback={null}>
        <AppHintsLoader locale={locale} userId={user.id} />
      </Suspense>

      <AppBottomNav locale={locale} />

      {subscription.is_admin && <AdminCopyBar locale={locale} />}
    </div>
  );
}
