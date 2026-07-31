"use client";

import { useState } from "react";
import { DecimalInput } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";

/**
 * A number question in the wizard, backed by the text the user actually typed.
 *
 * The answers object stores a number, but a half-typed "70." is not a number
 * yet — echoing the parsed value straight back into the field would delete the
 * decimal point the moment it was pressed. So the raw draft lives here and the
 * parsed number is pushed up. Each wizard step remounts (the step wrapper is
 * keyed), so the draft never leaks between questions.
 */
export function NumberField({
  value,
  onValueChange,
  decimal = false,
  placeholder,
  className,
}: {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** Weights accept a decimal; age and height are whole numbers. */
  decimal?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  function update(next: string) {
    const cleaned = decimal ? next : next.replace(/\./g, "");
    setDraft(cleaned);
    onValueChange(parseDecimal(cleaned) ?? undefined);
  }

  return (
    <DecimalInput
      value={draft}
      onValueChange={update}
      inputMode={decimal ? "decimal" : "numeric"}
      placeholder={placeholder}
      className={cn("text-center text-2xl", className)}
    />
  );
}
