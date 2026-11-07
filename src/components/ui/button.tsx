import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Rounded rectangles, not pills, and no glow or hover lift.
 *
 * The old primary carried a lime drop-glow and every button rose on hover.
 * On a phone there is no hover, and a glow on every call to action is how a
 * screen ends up with nothing standing out. What replaces both is the shared
 * `press` response: a quick shrink under the finger, which is what native
 * controls do and what makes a tap feel acknowledged.
 *
 * `secondary` is now a filled grey rather than an outline: a hairline outline
 * on near-black reads as a disabled control, and filled tints are how native
 * dark-mode apps mark the second choice.
 */
const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-display text-[17px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-bg hover:bg-accent-hover",
        secondary: "bg-surface2 text-ink hover:bg-[#3A3A3C]",
        ghost: "bg-transparent text-ink hover:bg-white/5",
      },
      size: {
        default: "h-[52px] px-6",
        sm: "h-10 rounded-xl px-4 text-[15px]",
        lg: "h-14 px-8",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
