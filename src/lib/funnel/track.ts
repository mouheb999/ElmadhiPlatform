"use client";

/**
 * One call site for "the visitor reached this point in the funnel".
 *
 * Before this existed, `recordFunnelStep` was called directly from /start and
 * nowhere else, so the measured funnel ended at `to_checkout`: every campaign
 * report could show that somebody reached the price and nothing after it. The
 * money is spent on the steps that were invisible — the account, the transfer,
 * the receipt — and "the ad is cheap but nobody subscribes" cannot be answered
 * without them.
 *
 * Two sinks, one call:
 *
 *   1. **`funnel_events`** — our own anonymous, insert-only drop-off table. A
 *      random per-visit id and a step name, nothing else. See actions/funnel.ts
 *      and migration 054.
 *   2. **Meta's pixel, if and only if one is configured.** The ad platform
 *      cannot optimise towards subscriptions it is never told about; today it
 *      optimises for landing-page views, which is why the traffic is cheap and
 *      the conversions are not. `components/funnel/meta-pixel.tsx` renders
 *      nothing without NEXT_PUBLIC_META_PIXEL_ID, so this half is inert until
 *      somebody makes that decision deliberately — the codebase's default
 *      remains no third-party tracker at all.
 *
 * Deduplicated per browsing session by the module-level set below, which is the
 * same guarantee the database's unique index gives: a visitor tapping back and
 * forth is one person reaching a step, not ten.
 */

import { recordFunnelStep } from "@/app/actions/funnel";
import { rawAttribution, visitId } from "./client-store";
import type { Locale } from "@/lib/i18n";

/**
 * The steps the back half of the funnel reports, named so a report reads in
 * order. The front half (`landed`, `q_*`, `i_*`, `building`, `reveal`,
 * `to_checkout`) is emitted by /start from the screen list itself.
 *
 * Every name must match the CHECK on `funnel_events.step` — lower-case,
 * digits and underscores, 40 characters or fewer.
 */
export const CHECKOUT_VIEWED = "checkout";
export const PLAN_SELECTED = "plan_selected";
export const SIGNUP_STARTED = "signup_started";
export const SIGNUP_DONE = "signup_done";
export const PAY_STEP = "pay_step";
export const METHOD_SELECTED = "method_selected";
export const RECEIPT_UPLOADED = "receipt_uploaded";
export const ACTIVATED = "activated";

/**
 * How a step is reported to Meta, when a pixel is configured.
 *
 * Standard event names where one honestly fits, because those are the ones the
 * ad platform can optimise and report against; a custom name where it does not.
 *
 * Two of these are worth being precise about, since they are what a campaign
 * would be optimised on:
 *
 *   - `Subscribe` fires when the receipt is attached. That is the customer's
 *     side of the transaction finished — the money has left their bank — and it
 *     is the last thing that happens while they are still on the page.
 *   - `Purchase` fires on activation, which is a human confirming the transfer
 *     hours later. It is the true conversion and it is the one to report value
 *     on, but it only reaches the pixel if the customer's browser is on the page
 *     when it flips. Both are sent so the two numbers can be compared rather
 *     than one standing in for the other.
 */
const META_EVENTS: Record<string, { name: string; standard: boolean }> = {
  q_goal: { name: "QuestionnaireStarted", standard: false },
  reveal: { name: "Lead", standard: true },
  [CHECKOUT_VIEWED]: { name: "ViewContent", standard: true },
  [PLAN_SELECTED]: { name: "PlanSelected", standard: false },
  [SIGNUP_STARTED]: { name: "InitiateCheckout", standard: true },
  [SIGNUP_DONE]: { name: "CompleteRegistration", standard: true },
  [PAY_STEP]: { name: "AddPaymentInfo", standard: true },
  [METHOD_SELECTED]: { name: "PaymentMethodSelected", standard: false },
  [RECEIPT_UPLOADED]: { name: "Subscribe", standard: true },
  [ACTIVATED]: { name: "Purchase", standard: true },
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** One report per step per browsing session. See the note above. */
const sent = new Set<string>();

export type TrackOptions = {
  /** The price in dinars, for the two events where money is the point. */
  value?: number;
};

/**
 * Report a step. Never throws, never blocks, never fails the page — analytics
 * is the least important thing happening on any screen it is called from.
 */
export function trackStep(step: string, locale: Locale, options: TrackOptions = {}): void {
  if (sent.has(step)) return;
  sent.add(step);

  try {
    const id = visitId();
    if (id) void recordFunnelStep(id, step, rawAttribution(), locale);
  } catch {
    // sessionStorage blocked, or the action is unreachable. Not load-bearing.
  }

  try {
    const meta = META_EVENTS[step];
    // Undefined until the pixel script has run, and forever when none is
    // configured — which is the default.
    if (!meta || typeof window === "undefined" || !window.fbq) return;
    const payload =
      options.value !== undefined
        ? { value: options.value, currency: "TND" }
        : undefined;
    window.fbq(meta.standard ? "track" : "trackCustom", meta.name, payload);
  } catch {
    // Same rule: a third-party script misbehaving must not reach the visitor.
  }
}
