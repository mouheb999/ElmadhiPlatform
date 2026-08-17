/**
 * The origin that confirmation and OAuth links come back to.
 *
 * Two constraints pull in opposite directions here.
 *
 * The security one: the origin must never come from the request. `Host` and
 * `x-forwarded-host` are set by the caller, so a request with
 * `Host: attacker.example` would mint a sign-up confirmation link pointing
 * there — and following that link hands the token in it to whoever owns that
 * host. Every source below is either operator-configured or set by the hosting
 * platform; none of them is request-derived.
 *
 * The operational one: `NEXT_PUBLIC_SITE_URL` cannot be the only source,
 * because `NEXT_PUBLIC_*` is inlined into the bundle at `next build` and then
 * frozen. If it was missing during the build that is serving production,
 * adding it in the dashboard changes nothing until someone rebuilds — and the
 * only symptom is sign-up and Google sign-in refusing to start. So the ordinary
 * cases resolve without it:
 *
 *   1. `SITE_URL` — no public prefix, therefore read from the real environment
 *      at request time. The escape hatch: set it, redeploy, done.
 *   2. `NEXT_PUBLIC_SITE_URL` — the historical name, still honoured.
 *   3. Vercel's own vars, which the platform injects at runtime.
 *      `VERCEL_PROJECT_PRODUCTION_URL` is the stable production domain;
 *      `VERCEL_URL` is the per-deployment hostname, which is what preview
 *      builds should be linking back to.
 *
 * Note that whatever this returns must also be listed in Supabase's Auth →
 * URL Configuration redirect allow-list, or Supabase drops the redirect and
 * sends the user to the project's Site URL instead. Preview deployments need a
 * wildcard entry there to work at all.
 */

export type OriginSources = {
  siteUrl?: string;
  publicSiteUrl?: string;
  vercelEnv?: string;
  vercelProductionUrl?: string;
  vercelUrl?: string;
};

/**
 * Coerce a configured value into a bare origin, or null if it is unusable.
 *
 * Tolerant on purpose: the value is typed into a hosting dashboard by hand, so
 * "yourdomain.com", a trailing slash, and stray whitespace are all likely and
 * none of them is worth failing a sign-up over.
 */
export function normalizeOrigin(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    // `.origin` drops any path, query, and trailing slash the operator pasted
    // in, so callers can always append "/dashboard" and get a sane URL.
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveOrigin(sources: OriginSources): string | null {
  const configured = normalizeOrigin(sources.siteUrl) ?? normalizeOrigin(sources.publicSiteUrl);
  if (configured) return configured;

  // On a preview deployment the production domain is the wrong answer: the
  // user is on the preview host and would be bounced to production mid-flow.
  const platform =
    sources.vercelEnv === "production"
      ? (sources.vercelProductionUrl ?? sources.vercelUrl)
      : (sources.vercelUrl ?? sources.vercelProductionUrl);
  return normalizeOrigin(platform);
}

/**
 * The same thing, read from this process's environment.
 *
 * Each variable is read as a literal `process.env.X` member expression rather
 * than by iterating `process.env`, because that is the form Next's build-time
 * substitution recognises for the `NEXT_PUBLIC_` one.
 */
export function siteOrigin(): string | null {
  return resolveOrigin({
    siteUrl: process.env.SITE_URL,
    publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercelEnv: process.env.VERCEL_ENV,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: process.env.VERCEL_URL,
  });
}
