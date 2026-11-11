/**
 * Phone numbers, normalised to E.164 before they ever reach the database.
 *
 * Dependency-free on purpose: the sign-up Server Function, the /phone gate and
 * the client-side form all need the same answer, and the client bundle should
 * not pull a server module in to get it.
 */

/** Tunisia. Most users are here, so a bare 8-digit number means this. */
export const DEFAULT_COUNTRY_CODE = "216";

/** Tunisian mobile prefixes. Landlines (7x) can't receive WhatsApp. */
const TN_MOBILE_FIRST_DIGIT = /^[2459]/;

/**
 * Turn what somebody typed into `+216XXXXXXXX`, or null if it can't be one.
 *
 * Accepts the shapes people actually use: `26 341 616`, `026341616`,
 * `+216 26 341 616`, `0021626341616`. Foreign numbers are kept as typed as
 * long as they carry their own country code — a chunk of the audience is
 * abroad, and rewriting those to +216 would be worse than rejecting them.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Keep a leading + as an explicit "this is already international" marker.
  const raw = input.trim();
  const hadPlus = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;

  if (hadPlus) {
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")
      ? `+${digits}`
      : null;
  }

  // A local number, possibly with the trunk 0 people add out of habit.
  const local = digits.replace(/^0+/, "");

  // Already carries the Tunisian country code without a plus.
  if (local.length === 11 && local.startsWith(DEFAULT_COUNTRY_CODE)) {
    const rest = local.slice(3);
    return TN_MOBILE_FIRST_DIGIT.test(rest) ? `+${local}` : null;
  }

  if (local.length === 8) {
    return TN_MOBILE_FIRST_DIGIT.test(local)
      ? `+${DEFAULT_COUNTRY_CODE}${local}`
      : null;
  }

  // Long enough to be foreign but with no country code to prove it — refusing
  // beats silently filing it under +216.
  return null;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/**
 * A wa.me deep link, optionally with the first message pre-typed.
 *
 * wa.me wants bare digits — a leading + gives "phone number shared via url is
 * invalid". Returns null when there is no usable number, so callers render the
 * "no number on file" state instead of a dead link.
 */
export function whatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const e164 = normalizePhone(phone);
  if (!e164) return null;
  const base = `https://wa.me/${e164.slice(1)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** `+21626341616` → `+216 26 341 616`, for display only. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+(216)(\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/**
 * Signing up with a phone number and a password, and nothing else.
 *
 * The account form was the second-largest leak in the funnel: 208 people chose
 * a plan and 54 finished the four fields behind it. Two of those fields — name
 * and email — were never needed to open an account. What is needed is a way to
 * reach the person on WhatsApp (the number) and a way back in (the password).
 *
 * Supabase Auth identifies an account by email, and its phone provider needs
 * an SMS gateway this product does not have. So a phone-only account is filed
 * under an address derived from the number, on a subdomain of our own that
 * receives no mail. Nothing is ever sent to it: sign-up auto-confirms, and
 * password reset for these accounts goes through support on WhatsApp.
 *
 * The derived address is an implementation detail and must never be shown to
 * the customer or handed to an ad platform as their email.
 */
export const PHONE_LOGIN_DOMAIN = "phone.hypefitness.club";

/** `+21626341616` → `21626341616@phone.hypefitness.club`, or null. */
export function phoneLoginEmail(phone: string | null | undefined): string | null {
  const e164 = normalizePhone(phone);
  return e164 ? `${e164.slice(1)}@${PHONE_LOGIN_DOMAIN}` : null;
}

/** True for an address this module made up, as opposed to one a person owns. */
export function isPhoneLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`);
}

/** A real address to show or send to, or null for a phone-only account. */
export function contactEmail(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e && !isPhoneLoginEmail(e) ? e : null;
}

/**
 * What somebody typed into the one sign-in field: an email, or a number.
 *
 * Anything with an @ is an email and is passed through untouched. Anything
 * else is tried as a phone number; null means it is neither.
 */
export function parseLoginIdentifier(
  input: string,
): { kind: "email"; email: string } | { kind: "phone"; phone: string } | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.includes("@")) return { kind: "email", email: raw.toLowerCase() };
  const phone = normalizePhone(raw);
  return phone ? { kind: "phone", phone } : null;
}
