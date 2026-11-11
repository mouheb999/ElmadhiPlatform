/**
 * Digital Asset Links — the file that makes the Android app a Trusted Web
 * Activity instead of a browser tab with a toolbar.
 *
 * Chrome fetches this on every TWA launch and checks that the app signing
 * certificate matches. If the check fails there is no error: the app simply
 * opens as a Custom Tab, with a URL bar across the top. That is the symptom to
 * look for, and it is the single most common thing to get wrong — see the
 * README in /android-twa.
 *
 * Served from a route handler rather than dropped in public/ for two reasons.
 * The fingerprint can then come from an environment variable, so rotating it
 * or fixing a mistake is a redeploy rather than a code change; and the
 * content type is stated outright, which Google requires to be
 * application/json and which a static file leaves to the host to infer.
 *
 * This path is outside `proxy.ts`'s matcher — that matcher is an allowlist, so
 * nothing had to be added to keep it out. It matters: Chrome fetches this
 * without cookies, so a 307 to /login here would break verification for
 * everyone.
 */

/**
 * The SHA-256 of the certificate Google Play signs the app with.
 *
 * NOT your upload key. With Play App Signing — which is mandatory for new apps
 * — Google re-signs every release, so the fingerprint that ends up on users'
 * devices is Play's, not the one from the keystore on your machine. Using the
 * upload key's fingerprint here is the classic failure and it cannot be caught
 * locally, because a locally built APK is signed with the upload key and
 * verifies fine.
 *
 * Get it from Play Console → Test and release → Setup → App signing →
 * "App signing key certificate" → SHA-256 certificate fingerprint. Then set
 * ANDROID_CERT_FINGERPRINT and redeploy.
 *
 * Both fingerprints can be listed at once — the array below takes more than
 * one — which is worth doing while testing a locally built APK alongside a
 * Play release.
 */
const PLACEHOLDER = "PASTE_PLAY_APP_SIGNING_SHA256_HERE";

/** Must match `packageId` in android-twa/twa-manifest.json. */
const PACKAGE_NAME = "club.hypefitness.app";

function fingerprints(): string[] {
  const configured = process.env.ANDROID_CERT_FINGERPRINT?.trim();
  if (!configured) return [PLACEHOLDER];
  // Comma-separated, so the upload key and the Play key can both be trusted
  // during a changeover without another deploy.
  return configured
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints(),
      },
    },
  ];

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      // Chrome caches verification aggressively. A short max-age means a
      // corrected fingerprint takes effect in minutes rather than whenever the
      // CDN feels like it, which matters on the day of a first upload.
      "Cache-Control": "public, max-age=300",
    },
  });
}
