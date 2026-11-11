import { cookies } from "next/headers";
import { AppHints } from "@/components/layout/app-hints";
import { isAppShell } from "@/lib/app-shell";
import { HINT_INSTALL_COOKIE, HINT_PROGRESS_COOKIE } from "@/lib/hints";
import type { Locale } from "@/lib/i18n";
import { loadJourney } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";

/**
 * Decides, on the server, which of the two pointers this account could still
 * be shown. See AppHints for what they are.
 *
 * Suspended by the layout — it reads cookies and, at most once per account
 * until the first pointer is dismissed, the two rows a timeline is built from.
 * After both are dismissed it returns before touching the database, which is
 * the state every regular member is in.
 */
export async function AppHintsLoader({ locale, userId }: { locale: Locale; userId: string }) {
  const store = await cookies();
  const progressDone = store.get(HINT_PROGRESS_COOKIE)?.value === "1";
  const installDone = store.get(HINT_INSTALL_COOKIE)?.value === "1";

  // The store apps are already on the home screen.
  const showInstall = !installDone && !(await isAppShell());

  // Only point at a timeline that exists.
  let showProgress = false;
  if (!progressDone) {
    try {
      showProgress = (await loadJourney(await createClient(), userId)) !== null;
    } catch {
      showProgress = false;
    }
  }

  if (!showProgress && !showInstall) return null;
  return <AppHints locale={locale} showProgress={showProgress} showInstall={showInstall} />;
}
