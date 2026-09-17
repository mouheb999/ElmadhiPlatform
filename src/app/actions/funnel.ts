"use server";

import { createClient } from "@/lib/supabase/server";
import { parseAttribution } from "@/lib/funnel/attribution";

/**
 * Drop-off tracking for the sign-up funnel.
 *
 * One call per screen reached on /start. It exists so that "the ad is working
 * but nobody subscribes" can be turned into "everybody leaves at question
 * four", which is a fixable sentence.
 *
 * Three deliberate properties:
 *
 *   - **It never fails the page.** Every path returns void and every error is
 *     swallowed. A visitor must never see the funnel break because analytics
 *     did; this is the least important write in the product.
 *   - **It carries no identity.** A random per-visit id, a step name, and the
 *     campaign parameters the ad platform put in the URL. No name, no email,
 *     no IP, no fingerprint — see migration 054.
 *   - **It is idempotent.** A unique index on (visit_id, step) means tapping
 *     back and forward does not inflate the funnel; the duplicate insert is
 *     expected and its error is discarded.
 */

/** Matches the CHECK on `funnel_events.step`. */
const STEP = /^[a-z0-9_]{1,40}$/;

/** Matches the CHECK on `funnel_events.visit_id` — a crypto.randomUUID(), normally. */
const VISIT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export async function recordFunnelStep(
  visitId: string,
  step: string,
  rawAttribution?: string | null,
  locale?: string,
): Promise<void> {
  // Checked here rather than left to the database constraint: a rejected
  // INSERT is a round-trip and a logged error for something the client should
  // not have sent in the first place.
  if (!VISIT_ID.test(visitId) || !STEP.test(step)) return;

  try {
    const supabase = await createClient();
    await supabase.from("funnel_events").insert({
      visit_id: visitId,
      step,
      attribution: parseAttribution(rawAttribution),
      locale: locale === "en" || locale === "tn" ? locale : null,
    });
  } catch {
    // Analytics is not allowed to be load-bearing. See above.
  }
}
