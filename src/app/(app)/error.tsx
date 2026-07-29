"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  t,
  type Locale,
} from "@/lib/i18n";

/**
 * The locale cookie, read on the client — an error boundary is a Client
 * Component and can't await `getLocale()`. Read through
 * `useSyncExternalStore` so the server render uses the default and the client
 * corrects it without a hydration mismatch.
 */
const subscribe = () => () => {};
const readLocaleCookie = (): Locale => {
  const value = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    readLocaleCookie,
    () => DEFAULT_LOCALE,
  );
}

/**
 * Catches a failed render of any signed-in route.
 *
 * Without this, a Supabase timeout mid-render became a bare 500 and the user
 * got the browser's own dead page — which, in the installed iOS PWA, is a black
 * "This page couldn't load" screen with no way back into the app. This keeps
 * them inside the shell, with a retry that re-runs only the failed segment.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();

  useEffect(() => {
    console.error("[app] render failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-hairline bg-surface">
        <AlertTriangle className="h-6 w-6 text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">
          {t(locale, "common.error_title")}
        </h1>
        <p className="max-w-xs text-sm text-muted">
          {t(locale, "common.error_body")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button onClick={reset} size="sm">
          {t(locale, "common.retry")}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">{t(locale, "common.go_home")}</Link>
        </Button>
      </div>
    </div>
  );
}
