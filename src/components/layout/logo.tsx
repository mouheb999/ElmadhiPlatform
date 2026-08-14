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

/**
 * Square tile variant, for slots that need a 1:1 mark. Drops the FITNESS subline —
 * it turns to mush much below 96px — and sits the HYPE mark on the dark tile + lime
 * glow that the generated app icons use.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10",
        "bg-gradient-to-br from-[#161616] to-[#070707] shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
        "h-12 w-12",
        className,
      )}
      aria-hidden="true"
    >
      {/* ambient lime glow behind the mark */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(192,218,27,0.4),transparent_65%)]" />
      <Image
        src="/logo-mark.png"
        alt=""
        width={900}
        height={278}
        sizes="128px"
        className="relative w-[86%] object-contain"
      />
    </span>
  );
}
