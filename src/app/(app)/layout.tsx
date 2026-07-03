import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { Logo } from "@/components/layout/logo";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";

export const dynamic = "force-dynamic";

/**
 * Shell for every signed-in pillar route (/dashboard, /diet, /workout, /qa,
 * /settings). `proxy.ts` already gates auth + payment_status before this
 * layout ever renders; the getUser() call here is defense-in-depth for
 * direct server-side rendering, not the primary gate.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-bg/95 px-4 py-3 backdrop-blur">
        <Logo className="h-9 w-9" wordmarkClassName="text-base" />
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"
        >
          <Bell className="h-5 w-5" />
        </button>
      </header>

      <main className="container-page flex-1 py-6 pb-28">{children}</main>

      <AppBottomNav locale={locale} />
    </div>
  );
}
