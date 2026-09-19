import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

/**
 * Returns the singleton PostHog Node.js client, or null when the token is not
 * configured (so callers can guard with a simple null-check rather than a
 * try/catch).
 *
 * Configured with `flushAt: 1, flushInterval: 0` so every enqueued event is
 * sent immediately — Next.js server actions and route handlers are short-lived
 * and may be torn down before a batched flush would fire.
 *
 * Always call `await posthog.flush()` after capturing in a short-lived context
 * to guarantee the HTTP send completes before the handler returns.
 */
export function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
          "this causes events to be silently missed. This error stops appearing once " +
          "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: host,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogClient;
}
