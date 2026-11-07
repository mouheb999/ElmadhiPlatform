import type { Locale } from "@/lib/i18n";

/**
 * A tab's opening header, drawn the way Today draws its own: a small grey
 * line in capitals above a large bold title.
 *
 * Every top-level tab uses this so moving between them feels like moving
 * between screens of one app. The small line carries context (today's date,
 * how the week is going), never a slogan. `trailing` sits at the end of that
 * line, for a streak or a count.
 */
export function PageHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header>
      {(eyebrow || trailing) && (
        <div className="flex min-h-6 items-center justify-between gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-subtle">{eyebrow}</p>
          {trailing}
        </div>
      )}
      <h1 className="mt-0.5 text-[34px] font-extrabold leading-tight tracking-[-0.025em]">{title}</h1>
    </header>
  );
}

/** Today's date in Tunis, in the reader's language — the default eyebrow. */
export function todayEyebrow(locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tn" ? "ar-TN" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Tunis",
  }).format(new Date());
}
