/**
 * A short-lived, signed "this account is paid up" ticket.
 *
 * The proxy has to answer "may this user reach the app?" on every navigation.
 * Answering it means a `profiles` round-trip to Supabase, and paying that on
 * every tap (plus every server-action POST and every RSC prefetch) is most of
 * why the app feels sluggish — the check costs more than the page it guards.
 *
 * So a *passing* verdict is cached in an HMAC-signed cookie for a couple of
 * minutes. Deliberate asymmetry:
 *
 *   - Only passes are cached. A user who just paid gets in on the very next
 *     request; nothing is cached that could keep them out.
 *   - A revoked or expired plan therefore lingers for at most TICKET_TTL_MS.
 *     That is the whole cost of this optimisation, and it is bounded and small.
 *
 * The ticket is bound to a user id and signed with a server-only secret, so it
 * can't be minted, edited, or replayed against another account. It is also not
 * an authorization primitive on its own: every row the app reads is still
 * scoped by RLS to the signed-in user.
 */

const TICKET_TTL_MS = 120_000;

export const GATE_COOKIE = "elmadhi_gate";

/** Server-only secret. Absent (e.g. misconfigured env) → caching is disabled. */
function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(payload),
  );
  return base64url(sig);
}

/** Constant-time string compare — no early exit on the first differing byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mints a ticket for `userId`, or null if signing isn't possible. */
export async function issueGateTicket(userId: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = `${userId}:${Date.now() + TICKET_TTL_MS}`;
  return `${payload}:${await sign(payload, key)}`;
}

/** True only for an unexpired, correctly signed ticket belonging to `userId`. */
export async function verifyGateTicket(
  ticket: string | undefined,
  userId: string,
): Promise<boolean> {
  const key = secret();
  if (!key || !ticket) return false;

  const parts = ticket.split(":");
  if (parts.length !== 3) return false;
  const [ticketUserId, expiresAt, signature] = parts;

  if (ticketUserId !== userId) return false;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;

  const expected = await sign(`${ticketUserId}:${expiresAt}`, key);
  return timingSafeEqual(signature, expected);
}

export const GATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(TICKET_TTL_MS / 1000),
} as const;
