import { AlertTriangle } from "lucide-react";

/**
 * Shown when a page's core query fails outright (e.g. a schema mismatch from
 * a pending migration). Deliberately distinct from `WarningBanner`, which is
 * for non-blocking plan/program validation — this means the page has nothing
 * real to show, so don't render an empty editor next to it.
 */
export function LoadFailure({ detail }: { detail?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p className="font-bold">Something went wrong loading this page.</p>
      <p className="max-w-sm text-sm text-muted">
        {detail ?? "Please try again in a moment."}
      </p>
    </div>
  );
}
