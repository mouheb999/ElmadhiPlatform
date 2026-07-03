import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One "why we picked this for you" block on a rationale screen
 * (personalization-engine.md §3 — every engine decision renders a trace like
 * this instead of being a black box).
 */
export function RationaleCard({
  headline,
  body,
  metric,
  emphasis = false,
  className,
}: {
  headline: string;
  body: string;
  metric?: { value: string; label: string };
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        emphasis && "border-accent/40 bg-accent/5",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-extrabold tracking-tight">{headline}</h3>
          {metric && (
            <div className="shrink-0 text-end">
              <div className="text-xl font-extrabold text-accent">{metric.value}</div>
              <div className="text-xs text-muted">{metric.label}</div>
            </div>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </CardContent>
    </Card>
  );
}
