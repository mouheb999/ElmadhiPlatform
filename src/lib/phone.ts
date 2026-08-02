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

/** `+21626341616` → `+216 26 341 616`, for display only. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+(216)(\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
