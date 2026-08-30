import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * HYPE FITNESS brand logo.
 *
 * The artwork carries the wordmark itself, so `Logo` is the lockup image alone —
 * there is no separate text to typeset next to it. `className` sizes it by height
 * (`h-*`); the width follows the 900×370 aspect ratio.
 *
 * `sizes` is pinned to the widest slot the logo actually occupies (the ~235px hero
 * on the landing page). Left to a viewport-relative hint the browser reaches for a
 * multi-thousand-pixel upscale of a logo that never renders above a few hundred.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="HYPE FITNESS"
      width={900}
      height={370}
      priority
      sizes="240px"
      className={cn("h-10 w-auto shrink-0", className)}
    />
  );
}
