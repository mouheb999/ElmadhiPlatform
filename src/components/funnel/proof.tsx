"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Dumbbell,
  MessageCircleQuestion,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import {
  PROOF_POINTS,
  TESTIMONIALS,
  testimonialText,
  type ProofPoint,
} from "@/lib/social-proof";

/**
 * The three blocks that answer "why should I believe you" — used by the funnel
 * on /start and again on /checkout, so the argument does not change shape
 * halfway through the purchase.
 *
 * `Testimonials` renders nothing at all while `TESTIMONIALS` is empty, which
 * is how it ships. See lib/social-proof.ts for why that is deliberate: an
 * invented quote is the one thing on a payment page that can cost more than it
 * earns.
 */

const ICONS: Record<ProofPoint["icon"], typeof Dumbbell> = {
  dumbbell: Dumbbell,
  utensils: Utensils,
  sparkles: Sparkles,
  message: MessageCircleQuestion,
  trending: TrendingUp,
};

/**
 * What the app does, in the reader's language.
 *
 * `limit` exists because the funnel shows three of these mid-questionnaire —
 * enough to be worth the pause, short enough that it is not a page to read —
 * while checkout shows all five.
 */
export function ProofPoints({
  locale,
  limit,
  className,
}: {
  locale: Locale;
  limit?: number;
  className?: string;
}) {
  const points = limit ? PROOF_POINTS.slice(0, limit) : PROOF_POINTS;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {points.map((point) => {
        const Icon = ICONS[point.icon];
        return (
          <li
            key={point.id}
            className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15">
              <Icon className="h-[18px] w-[18px] text-accent" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-[15px] font-extrabold leading-tight">
                {testimonialText(locale, point.title)}
              </span>
              <span className="text-[13px] leading-relaxed text-muted">
                {testimonialText(locale, point.body)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Real customers, or nothing on the screen.
 *
 * `limit` lets the funnel show one between questions and checkout show the
 * lot, without two components drifting apart.
 */
export function Testimonials({
  locale,
  limit,
  heading = true,
  className,
}: {
  locale: Locale;
  limit?: number;
  heading?: boolean;
  className?: string;
}) {
  if (TESTIMONIALS.length === 0) return null;
  const shown = limit ? TESTIMONIALS.slice(0, limit) : TESTIMONIALS;

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {heading && (
        <h2 className="text-center font-display text-lg font-extrabold tracking-tight">
          {t(locale, "proof.title")}
        </h2>
      )}
      {shown.map((item) => (
        <figure
          key={item.id}
          className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface px-4 py-4"
        >
          <Quote className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <blockquote className="text-[13.5px] leading-relaxed text-ink">
            {testimonialText(locale, item.quote)}
          </blockquote>
          <figcaption className="flex items-center gap-3">
            {item.photo && (
              <Image
                src={item.photo}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-bold text-ink">{item.name}</span>
              {item.context && (
                <span className="text-xs text-muted">{testimonialText(locale, item.context)}</span>
              )}
            </span>
            {item.result && (
              <span className="ms-auto shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
                <bdi>{testimonialText(locale, item.result)}</bdi>
              </span>
            )}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

/** What happens if the plan turns out to be wrong for them. */
export function Guarantee({ locale }: { locale: Locale }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3.5">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-[14px] font-extrabold leading-tight">
          {t(locale, "co.guarantee_title")}
        </span>
        <span className="text-[12.5px] leading-relaxed text-muted">
          {t(locale, "co.guarantee_body")}
        </span>
      </span>
    </div>
  );
}

/**
 * The six questions a first-time buyer has at a manual-transfer checkout.
 *
 * Closed by default and answered in one tap. An unanswered objection at the
 * payment screen is a closed tab; an objection the page has already named is
 * usually just a nod.
 */
const FAQ: { q: StringKey; a: StringKey }[] = [
  { q: "faq.q_when", a: "faq.a_when" },
  { q: "faq.q_auto", a: "faq.a_auto" },
  { q: "faq.q_beginner", a: "faq.a_beginner" },
  { q: "faq.q_gym", a: "faq.a_gym" },
  { q: "faq.q_food", a: "faq.a_food" },
  { q: "faq.q_help", a: "faq.a_help" },
];

export function Faq({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState<StringKey | null>(null);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-center font-display text-lg font-extrabold tracking-tight">
        {t(locale, "faq.title")}
      </h2>
      {FAQ.map((item) => {
        const isOpen = open === item.q;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.q)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start"
            >
              <span className="text-[14px] font-bold text-ink">{t(locale, item.q)}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {isOpen && (
              <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted">
                {t(locale, item.a)}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
