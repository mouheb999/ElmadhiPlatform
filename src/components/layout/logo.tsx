import Image from "next/image";
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
 * ELMADHI brand logo — the FM mark artwork (public/logo.png) sitting on a soft
 * light gradient tile, paired with the ELMADHI wordmark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10",
        // dark tile with a green glow, matching the app-icon brand style
        "bg-gradient-to-br from-[#161616] to-[#070707] shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
        "h-12 w-12",
        className,
      )}
      aria-hidden="true"
    >
      {/* ambient green glow behind the mark */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_62%_38%,rgba(93,214,44,0.45),transparent_62%)]" />
      <Image
        src="/logo.png"
        alt=""
        fill
        sizes="96px"
        priority
        className="relative object-contain p-1.5"
      />
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
      <span className={cn("text-lg tracking-tight", wordmarkClassName)}>
        ELMADHI
      </span>
    </span>
  );
}
