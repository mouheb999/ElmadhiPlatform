import * as React from "react";
import { cn, toDecimalDraft } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-hairline bg-surface px-4 text-base text-ink",
          "placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export type DecimalInputProps = Omit<InputProps, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A number field that survives a comma.
 *
 * `type="number"` is deliberately avoided: on a phone keyboard set to Arabic
 * the decimal mark is "," and the browser hands an unparseable value back as
 * an empty string, so the user's 70,5 kg becomes nothing. This is a text field
 * with the decimal keypad, normalizing what was typed (see `toDecimalDraft`)
 * so "70,5" and "٧٠٫٥" both end up as "70.5".
 */
const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ onValueChange, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        onChange={(e) => onValueChange(toDecimalDraft(e.target.value))}
      />
    );
  },
);
DecimalInput.displayName = "DecimalInput";

export { Input, DecimalInput };
