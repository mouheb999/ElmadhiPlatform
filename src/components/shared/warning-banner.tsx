"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Warnings, never blocks (architecture.md §6) — dismissible, non-blocking. */
export function WarningBanner({
  message,
  dismissible = true,
  className,
}: {
  message: string;
  dismissible?: boolean;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 leading-relaxed">{message}</p>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
