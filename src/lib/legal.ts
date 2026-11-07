/**
 * Contact details the privacy policy and the account-deletion page print.
 *
 * Read from the environment so the address can be set on Vercel without a
 * code change. Both stores want a way to reach you about privacy; until this
 * is set the pages point people to in-app support instead.
 */
export const PRIVACY_CONTACT_EMAIL: string | null = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

/** Shown on both legal pages. Update it whenever their wording changes. */
export const LEGAL_LAST_UPDATED = "2026-11-07";
