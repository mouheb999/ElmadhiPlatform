"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Back to wherever the reader came from — Settings inside the app, the login
 * screen or a store listing on the web. With no history (a link opened in a
 * fresh tab) it goes to the home page instead of doing nothing.
 */
export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      aria-label={label}
      className="press grid h-10 w-10 place-items-center rounded-full bg-surface2 text-ink"
    >
      <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
    </button>
  );
}
