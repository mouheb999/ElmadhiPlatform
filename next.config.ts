import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Besides the Meta Pixel (see the CSP below), Supabase is the only third-party
 * origin the browser would talk to directly — and today it doesn't: `src/lib/supabase/client.ts` is imported by nothing,
 * every read and write goes through a Server Function. It is listed anyway so
 * that the first browser-side query doesn't fail in production with a CSP
 * error nobody expects.
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  } catch {
    // Unset at build time (e.g. a bare CI checkout) — fall back to the
    // project-agnostic host rather than emitting a broken directive.
    return "https://*.supabase.co";
  }
})();

/**
 * Meta's pixel, when one is configured.
 *
 * The policy stays exactly as tight as it is today for every deployment that
 * has not set NEXT_PUBLIC_META_PIXEL_ID: no facebook.net script, no
 * facebook.com beacon, no tracking pixel image. Turning the pixel on is one
 * environment variable, and it opens precisely the three origins it needs.
 */
const metaPixelOn = /^\d{5,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "");
const metaScript = metaPixelOn ? " https://connect.facebook.net" : "";
const metaConnect = metaPixelOn
  ? " https://connect.facebook.net https://www.facebook.com"
  : "";
const metaImg = metaPixelOn ? " https://www.facebook.com" : "";

/**
 * Content Security Policy.
 *
 * `script-src` carries 'unsafe-inline', which is the honest state of this
 * policy: Next injects inline bootstrap scripts, and the strict alternative
 * (per-request nonces via proxy.ts) means threading a nonce through
 * `updateSession` — the auth-critical path — and widening the proxy matcher to
 * routes that currently, deliberately, skip it. That is a change to make with
 * time to test it, not the week of a launch.
 *
 * What this policy does buy today is everything that is not script-src:
 * frame-ancestors stops the app being framed, base-uri stops a <base> tag
 * rewriting every relative URL, form-action stops a form being pointed at
 * another origin, object-src kills plugin embeds, and the allow-lists mean a
 * script or image from an unexpected host is refused. The XSS surface it does
 * not cover is small by construction here: React escapes by default, there is
 * no dangerouslySetInnerHTML anywhere in src/, and react-markdown renders no
 * raw HTML without rehype-raw, which is not installed.
 *
 * TODO: nonce-based script-src, per
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 * Every (app) route is already force-dynamic, so the dynamic-rendering
 * requirement that approach imposes is already met.
 */
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' in dev only: React uses eval to rebuild server error stacks.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${metaScript}`,
  // Inline style attributes are how framer-motion animates. A nonce here would
  // be ignored by the browser anyway once 'unsafe-inline' is present.
  "style-src 'self' 'unsafe-inline'",
  // data: — camera captures are canvas data URLs; i.ytimg.com — video
  // thumbnails; Supabase — admin-uploaded exercise and food images.
  `img-src 'self' data: blob: https://i.ytimg.com ${supabaseOrigin}${metaImg}`,
  "media-src 'self' blob:",
  // next/font self-hosts Cairo and Tajawal, so no Google Fonts origin here.
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}${metaConnect}${
    isDev ? " ws://localhost:* http://localhost:*" : ""
  }`,
  // The exercise demo modal embeds YouTube's no-cookie player.
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Omitted in dev: it would rewrite http://localhost subresources to https.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Legacy companion to frame-ancestors, for browsers predating CSP level 2.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera=(self) is load-bearing: the meal photo flow calls getUserMedia.
  // Everything the app never asks for is denied outright.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Two years, subdomains included. Deliberately no `preload` — that is a
  // one-way door owned by the browser vendors, not something to opt into
  // before the production domain has settled.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// Derive the PostHog assets host from the ingestion host env var so the
// reverse proxy destinations stay in sync without duplicating the origin.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
const posthogAssetsHost = posthogHost
  .replace("//us.i.", "//us-assets.i.")
  .replace("//eu.i.", "//eu-assets.i.");

const nextConfig: NextConfig = {
  // Nothing is gained by announcing the framework and version to a scanner.
  poweredByHeader: false,

  // PostHog reverse proxy — routes /ingest/* through the server so the
  // browser never connects to PostHog directly (avoids ad-blocker drops).
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${posthogAssetsHost}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },

  // Required to support PostHog trailing-slash API requests through the proxy.
  skipTrailingSlashRedirect: true,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
