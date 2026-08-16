import Link from "next/link";
import { ListChecks, Sparkles, Wrench } from "lucide-react";
import { t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * The fork at the top of both makers: answer questions, or build it yourself.
 *
 * Deliberately a real choice on its own screen rather than a link buried under
 * the questionnaire. Somebody who already knows they want to pick their own
 * exercises should not have to discover that by starting a wizard they intend
 * to abandon — and somebody who doesn't know should not be handed a blank
 * screen, which is why guided keeps the visual weight and the badge.
 *
 * Server component: it is three links and no state.
 */
export function BuildModeChoice({
  locale,
  title,
  guidedHref,
  guidedBody,
  customHref,
  customBody,
}: {
  locale: Locale;
  /** Section heading — "Workout Maker" / "Nutrition Maker" or similar. */
  title: string;
  guidedHref: string;
  guidedBody: StringKey;
  customHref: string;
  customBody: StringKey;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "build.choose_title")}</p>
      </div>

      <Link
        href={guidedHref}
        className="relative flex flex-col gap-2 rounded-3xl border border-accent bg-accent/5 p-5 ring-1 ring-accent transition-transform hover:-translate-y-0.5"
      >
        <span className="absolute -top-2.5 start-4 flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">
          <Sparkles className="h-3 w-3" />
          {t(locale, "build.recommended")}
        </span>
        <span className="flex items-center gap-2 pt-1 font-display text-lg font-extrabold">
          <ListChecks className="h-5 w-5 text-accent" />
          {t(locale, "build.guided_title")}
        </span>
        <span className="text-sm leading-relaxed text-muted">{t(locale, guidedBody)}</span>
      </Link>

      <Link
        href={customHref}
        className="flex flex-col gap-2 rounded-3xl border border-hairline bg-surface p-5 transition-colors hover:border-accent/50"
      >
        <span className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Wrench className="h-5 w-5 text-muted" />
          {t(locale, "build.custom_title")}
        </span>
        <span className="text-sm leading-relaxed text-muted">{t(locale, customBody)}</span>
      </Link>
    </div>
  );
}
