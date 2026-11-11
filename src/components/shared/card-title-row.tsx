import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * A card's title row, drawn inside the card the way native summary cards are:
 * the title top-left at 20px, and — when the card leads somewhere — a small
 * grey disc with a chevron top-right.
 *
 * The disc is 24px, which is the look; the link around it is padded out to a
 * 44px touch target with a negative margin, so the look and the hit area are
 * not traded against each other.
 */
export function CardTitleRow({
  title,
  href,
  linkLabel,
  transitionType = "tab",
  trailing,
}: {
  title: string;
  href?: string;
  /** Accessible name for the chevron link; defaults to the title. */
  linkLabel?: string;
  transitionType?: "tab" | "nav-forward";
  /** Anything to show before the chevron, e.g. a count. */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{title}</h2>
      <div className="flex items-center gap-2.5">
        {trailing}
        {href && (
          <Link
            href={href}
            transitionTypes={[transitionType]}
            aria-label={linkLabel ?? title}
            className="press -m-2.5 grid place-items-center p-2.5"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#5E5E60] text-[#1C1C1E]">
              <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={2.8} />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
