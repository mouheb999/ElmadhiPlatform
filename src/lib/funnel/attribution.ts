/**
 * Which ad the money came from.
 *
 * Without this, a paid campaign is a number going out and a number coming in
 * with nothing joining them: you can see that twelve people subscribed this
 * week and not which creative, placement or audience produced them, which
 * means every decision about where to spend next is a guess. The click carries
 * the answer in its query string for exactly one page load, so it is read on
 * the first screen the visitor sees and kept until they either buy or forget
 * about us.
 *
 * Small and deliberately dumb: no fingerprinting, no third-party pixel, no
 * identifier of any kind that outlives the cookie. It stores what the ad
 * platform already put in the URL and the host that sent them, both of which
 * the visitor's browser handed us anyway.
 */

/** Where the ad parameters live between the click and the sign-up. */
export const ATTRIBUTION_COOKIE = "elmadhi_src";

/** Same thirty days as the funnel answers; they expire as a pair. */
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30;

/** Per field. Long enough for real campaign names, short enough to bound the cookie. */
const MAX_VALUE = 120;

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Meta / TikTok / Google click ids, whichever came with the click. */
  clickId?: string;
  /** The host that linked here — never the full URL, which can carry anything. */
  referrerHost?: string;
  /** When the click landed, ISO. Lets a stale attribution be recognised later. */
  at?: string;
};

/** Anything below U+0020, plus DEL. Written as a range so the source stays readable. */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/**
 * Trim a query-string value to something safe to store and print.
 *
 * Ad platforms interpolate campaign names into these, and campaign names are
 * written by humans in a hurry. Control characters out, length capped, and an
 * empty result becomes undefined rather than "".
 */
function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(CONTROL_CHARS, "").trim().slice(0, MAX_VALUE);
  return trimmed || undefined;
}

/** The click-id parameter names worth keeping, in the order we prefer them. */
const CLICK_IDS = ["fbclid", "ttclid", "gclid", "msclkid", "igshid"] as const;

/** Which platform a bare click id implies, when no utm_source came with it. */
const CLICK_ID_SOURCE: Record<(typeof CLICK_IDS)[number], string> = {
  fbclid: "meta",
  ttclid: "tiktok",
  gclid: "google",
  msclkid: "bing",
  igshid: "instagram",
};

/**
 * Read an attribution off a landing URL.
 *
 * Returns null when the visit carries nothing — somebody typing the address in,
 * or moving between pages — so the caller can leave an existing attribution
 * alone instead of overwriting a real ad click with an empty one.
 */
export function attributionFromParams(
  params: URLSearchParams,
  referrer?: string | null,
): Attribution | null {
  const attribution: Attribution = {
    source: clean(params.get("utm_source")),
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
    term: clean(params.get("utm_term")),
  };

  for (const key of CLICK_IDS) {
    const value = clean(params.get(key));
    if (value) {
      attribution.clickId = value;
      // The platform matters more than the id: an fbclid with no utm_source is
      // still a Meta click and should not be filed under "direct".
      attribution.source ??= CLICK_ID_SOURCE[key];
      break;
    }
  }

  if (referrer) {
    try {
      attribution.referrerHost = clean(new URL(referrer).host);
    } catch {
      // A referrer we cannot parse is not worth a line in the logs.
    }
  }

  const hasAnything = Object.values(attribution).some((v) => v !== undefined);
  if (!hasAnything) return null;

  attribution.at = new Date().toISOString();
  return attribution;
}

/** Parse the cookie back, dropping anything that is not a short string. */
export function parseAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const input = data as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of [
    "source",
    "medium",
    "campaign",
    "content",
    "term",
    "clickId",
    "referrerHost",
    "at",
  ] as const) {
    const value = input[key];
    if (typeof value === "string") {
      const trimmed = clean(value);
      if (trimmed) out[key] = trimmed;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Should a fresh click replace what is already stored?
 *
 * Last *paid* touch: a new ad click always wins, because it is the one the
 * campaign report will be asked about. An ordinary visit — no utm, no click id
 * — never overwrites, so walking from the landing page into the funnel does not
 * quietly relabel a Meta customer as organic.
 */
export function shouldReplace(incoming: Attribution | null): boolean {
  if (!incoming) return false;
  return !!(incoming.clickId || incoming.source || incoming.campaign || incoming.medium);
}
