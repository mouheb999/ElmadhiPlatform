import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Numbers as a Tunisian phone actually types them.
 *
 * An Arabic keyboard has no dot on the number row — the decimal mark is a
 * comma (or the Arabic comma "،"), and the digits may come out Arabic-Indic
 * (٧٠٫٥). `<input type="number">` silently discards anything it can't parse, so
 * "70,5" reaches onChange as an empty string and the user watches their weight
 * disappear. Every number field the user types into goes through here instead.
 */
export function normalizeDecimal(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹
    .replace(/[,،٫]/g, "."); // , ، ٫
}

/**
 * What to keep in the field while the user is still typing: digits and at most
 * one decimal point. Intermediate states like "70." are preserved on purpose —
 * stripping the dot would make it impossible to type the digit after it.
 */
export function toDecimalDraft(value: string): string {
  const [head, ...rest] = normalizeDecimal(value).replace(/[^\d.]/g, "").split(".");
  return rest.length > 0 ? `${head}.${rest.join("")}` : head;
}

/** Parses a user-typed number ("70,5", "٧٠٫٥", "70.5"). Null when unusable. */
export function parseDecimal(value: string): number | null {
  const parsed = parseFloat(normalizeDecimal(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}
