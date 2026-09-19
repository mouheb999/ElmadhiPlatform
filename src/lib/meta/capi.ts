import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { normalizePhone } from "@/lib/phone";
import { siteOrigin } from "@/lib/site-url";
import { META_PIXEL_ID } from "@/lib/meta/pixel";

/**
 * Meta Conversions API — the server half of the pixel.
 *
 * What may go into an event is deliberately narrow: hashed email and phone, the
 * account id, Meta's own click cookies, IP and user agent, and for a Purchase
 * the value and currency. Questionnaire answers, injuries, weight and goals are
 * health data and never leave for an ad platform — there is no field on
 * `MetaEvent` that could carry them, and that is the point of typing it this
 * tightly.
 *
 * Every send is best-effort. An outage at Meta must never fail a sign-up or an
 * activation, so errors are logged and swallowed.
 */

const GRAPH_VERSION = "v24.0";
const TIMEOUT_MS = 5000;

export type MetaClientContext = {
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  userAgent: string | null;
};

export type MetaEvent = {
  name: "CompleteRegistration" | "Purchase";
  /** Shared with the browser event for dedup, or unique per sale for retries. */
  eventId: string;
  /** Seconds since epoch. Defaults to now. */
  time?: number;
  /** Path on this site the event belongs to, e.g. "/checkout". */
  path: string;
  user: {
    id?: string | null;
    email?: string | null;
    phone?: string | null;
  } & Partial<MetaClientContext>;
  value?: number;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Lowercase and trimmed, per Meta's customer-information rules. */
export function normalizeEmailForMeta(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/** `216XXXXXXXX`: country code and digits only, no `+`, no spaces. */
export function normalizePhoneForMeta(phone: string | null | undefined): string | null {
  const e164 = normalizePhone(phone);
  return e164 ? e164.slice(1) : null;
}

/**
 * The customer's click cookies, IP and user agent, read off the current
 * request. Only meaningful inside a Server Function or Route Handler invoked
 * by the customer's own browser — never the admin's.
 */
export async function readClientContext(): Promise<MetaClientContext> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    fbp: jar.get("_fbp")?.value ?? null,
    fbc: jar.get("_fbc")?.value ?? null,
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

export async function sendMetaEvent(event: MetaEvent): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || !META_PIXEL_ID) return;

  const email = normalizeEmailForMeta(event.user.email);
  const phone = normalizePhoneForMeta(event.user.phone);
  const { fbp, fbc, ip, userAgent } = event.user;

  const userData: Record<string, string[] | string> = {};
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (event.user.id) userData.external_id = [sha256(event.user.id)];
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const origin = siteOrigin() ?? "";
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.name,
        event_time: event.time ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: `${origin}${event.path}`,
        // "website" requires a user agent; an activation whose checkout row
        // predates migration 056 has none, and is honestly system-generated.
        action_source: userAgent ? "website" : "system_generated",
        user_data: userData,
        ...(event.value !== undefined
          ? { custom_data: { value: event.value, currency: "TND" } }
          : {}),
      },
    ],
  };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.error(`[meta] ${event.name} rejected (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error(`[meta] ${event.name} not sent:`, err);
  }
}
