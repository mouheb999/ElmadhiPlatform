import { cn } from "@/lib/utils";

/**
 * The one chip style in the app: white with black text when selected, dark
 * grey with white text otherwise, no outlines. Used for every row of choices
 * — Today/Plan, workout days, meal slots, chart ranges — so a choice looks
 * the same wherever it appears.
 */
export function chipClass(active: boolean, size: "md" | "sm" = "md"): string {
  return cn(
    "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold outline-none transition-colors",
    size === "md" ? "h-10 px-4 text-[15px]" : "h-8 px-3 text-[13px]",
    active ? "bg-ink text-bg" : "bg-surface2 text-ink",
  );
}
