import { cn } from "@/lib/utils";

type LogoProps = {
  /** Render only the icon tile, without the ELMADHI wordmark. */
  markOnly?: boolean;
  /** Tailwind size classes for the mark tile (default: h-11 w-11). */
  className?: string;
  /** Extra classes for the wordmark text. */
  wordmarkClassName?: string;
};

/**
 * ELMADHI brand logo — green gradient arrow mark inside a dark app-icon tile,
 * paired with the ELMADHI wordmark. No "Coaching Platform" sub-label.
 *
 * To use the exact uploaded artwork instead of this SVG recreation, drop the
 * file at `public/logo.png` and swap <LogoMark /> for a next/image <Image>.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        "h-11 w-11",
        className
      )}
      aria-hidden="true"
    >
      {/* ambient green glow behind the mark */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(93,214,44,0.35),transparent_65%)]" />
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className="relative h-[62%] w-[62%]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="elmadhi-mark" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7DEE4A" />
            <stop offset="1" stopColor="#337418" />
          </linearGradient>
        </defs>
        {/* back chevron — folded plane for depth */}
        <path
          d="M10 12 L30 32 L10 52 L22 52 L42 32 L22 12 Z"
          fill="url(#elmadhi-mark)"
          opacity="0.55"
        />
        {/* front chevron — main forward arrow */}
        <path
          d="M26 12 L46 32 L26 52 L40 52 L60 32 L40 12 Z"
          fill="url(#elmadhi-mark)"
        />
      </svg>
    </span>
  );
}

export function Logo({ markOnly, className, wordmarkClassName }: LogoProps) {
  if (markOnly) {
    return <LogoMark className={className} />;
  }

  return (
    <span className="flex items-center gap-2.5 font-extrabold">
      <LogoMark className={className} />
      <span className={cn("text-lg tracking-tight", wordmarkClassName)}>ELMADHI</span>
    </span>
  );
}
