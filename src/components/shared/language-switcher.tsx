"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "tn", label: "عربي" },
];

/**
 * Two-way language toggle (English / Tunisian Arabic). Writes the locale cookie
 * via the `setLocale` action, then refreshes so every server component re-renders
 * in the new language and the document `dir` flips.
 */
export function LanguageSwitcher({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-hairline bg-surface p-0.5",
        isPending && "opacity-60",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => choose(opt.value)}
            aria-pressed={active}
            className={cn(
              "min-w-10 rounded-full px-3 py-1 text-sm font-bold transition-colors",
              active
                ? "bg-accent text-bg"
                : "text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
