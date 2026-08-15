"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { readFlag, writeFlag } from "@/lib/copy-edit";

/**
 * The Settings switch that turns copy editing on.
 *
 * It lives here rather than as a permanently floating button because edit mode
 * changes what tapping anything does — every click is captured — and that is
 * not something to leave one stray tap away while an admin is using the app
 * normally.
 */
export function EditModeToggle({ label }: { label: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => setOn(readFlag()), []);

  function toggle() {
    const next = !on;
    writeFlag(next);
    setOn(next);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center justify-between gap-3 p-6 text-start font-bold text-accent hover:bg-white/5"
    >
      <span className="flex items-center gap-2">
        <Pencil className="h-4 w-4" />
        {label}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-accent" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-bg transition-all ${
            on ? "start-6" : "start-1"
          }`}
        />
      </span>
    </button>
  );
}
