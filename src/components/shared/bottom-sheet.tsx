"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * False during the server render and hydration, true after. A portal needs
 * `document`, and rendering one only on the client would make the first
 * client render disagree with the server's HTML — React would throw a
 * hydration mismatch. The server snapshot keeps both sides at "nothing" until
 * hydration is done.
 */
function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * A native-style bottom sheet: slides up over a dimmed screen, springs into
 * place, dismisses on the backdrop, Escape or Cancel.
 *
 * Exists because a form sitting inline on a screen is the most web-like thing
 * a page can do. The morning check-in used to be two number fields and five
 * buttons in the middle of Today; now Today shows one row, and the form lives
 * in a sheet that arrives when you ask for it.
 *
 * Always mounted, translated off-screen when closed, so opening and closing
 * both animate — a sheet that only exists while open can only animate in. It
 * is portalled to <body> so no ancestor's overflow or transform can clip it
 * or break its fixed positioning. The curve is the one native sheets use: a
 * fast start that settles without overshooting.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  cancelLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  cancelLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the sheet on touch.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div aria-hidden={!open} className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}>
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/55 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[28px] bg-[#1C1C1E] px-5 pt-2 outline-none",
          "pb-[calc(env(safe-area-inset-bottom)+24px)]",
          "transition-transform duration-500 [transition-timing-function:cubic-bezier(.32,.72,0,1)]",
          open ? "translate-y-0" : "translate-y-[105%]",
          className,
        )}
      >
        <div className="mx-auto h-[5px] w-9 rounded-full bg-[#48484A]" aria-hidden />
        <div className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-center">
          <button
            type="button"
            onClick={onClose}
            className="justify-self-start text-[16px] text-[#D4D4D8]"
          >
            {cancelLabel}
          </button>
          <span className="text-[17px] font-bold">{title}</span>
          <span />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
