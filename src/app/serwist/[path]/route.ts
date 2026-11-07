import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * A version string that changes on every deploy, and never fails a build.
 *
 * Serwist stamps this onto the precached `/~offline` entry; when it changes,
 * the entry is refetched rather than served from the previous build's cache.
 * Get it wrong in the "never changes" direction and people keep a stale
 * offline page forever; get it wrong in the "throws" direction and the build
 * dies somewhere with no .git — a container, a CI checkout exported from a
 * tarball, a `npm pack` of the source.
 *
 * It must identify the BUILD, not the commit. That distinction was found the
 * hard way: with `git rev-parse HEAD` as the source, two builds of the same
 * commit produce the same revision, so Serwist treats the entry as unchanged
 * and keeps serving the previous build's copy. In testing that showed up as an
 * offline page rendering unstyled, because the HTML it had kept referenced
 * hashed assets the new build had replaced. The same thing happens in
 * production on any redeploy that is not a new commit — a rollback, a changed
 * environment variable, a retried deploy, the Redeploy button.
 *
 * So, four sources, best first:
 *
 *   1. `VERCEL_DEPLOYMENT_ID`, unique per deployment. The only one of these
 *      that is genuinely one-to-one with a build.
 *   2. `VERCEL_GIT_COMMIT_SHA`, which is right for every deploy that is a new
 *      commit — the ordinary case — and is kept as a readable fallback.
 *   3. `git rev-parse HEAD`, for local builds and any host that is not Vercel.
 *   4. The build's own clock, so a checkout with no .git still builds.
 *
 * Evaluated once at module load, during the static generation of this route,
 * so the subprocess runs at most once per build and never per request.
 */
function precacheRevision(): string {
  const fromDeployment = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (fromDeployment) return fromDeployment;

  const fromPlatform = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromPlatform) return fromPlatform;

  try {
    const result = spawnSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf-8",
      // A hung git (a prompt for credentials, a locked index) must not hang
      // the build.
      timeout: 5000,
    });
    const sha = result.stdout?.trim();
    // Suffixed with the build's clock, not bare, for the reason above: off
    // Vercel there is no deployment id, and a bare SHA would let a rebuild of
    // the same commit serve the previous build's page. The cost is that two
    // builds of one commit are not byte-identical here; the benefit is that
    // the stale-page failure cannot happen at all. One small page is refetched
    // per build, which nobody will notice.
    if (result.status === 0 && sha) return `${sha}-${Date.now()}`;
  } catch {
    // No git binary, no repository, no permission — fall through.
  }

  return `build-${Date.now()}`;
}

/**
 * Builds and serves the service worker at /serwist/sw.js.
 *
 * `createSerwistRoute` declares itself `force-static`, so the worker is
 * compiled once at build time and served as a static asset, not rebuilt per
 * request.
 *
 * Note this path is outside `proxy.ts`'s matcher — that matcher is an
 * allowlist, so nothing needs to be added to keep it out. It matters: a
 * service worker that 307'd to /login for a signed-out visitor would never
 * register at all.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    // Not discovered by the glob — it is a route, not a file on disk — so the
    // offline page is named explicitly or it is not there when it is needed.
    additionalPrecacheEntries: [{ url: "/~offline", revision: precacheRevision() }],
    useNativeEsbuild: true,
  });
