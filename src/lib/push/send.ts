import "server-only";
import webpush from "web-push";

/**
 * Sending a push, and the three keys it needs.
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   handed to the browser when it subscribes
 *   VAPID_PRIVATE_KEY              signs every send; server only
 *   VAPID_SUBJECT                  a contact for the push service, as
 *                                  `mailto:…` or an https URL
 *
 * Generate the pair once with `npx web-push generate-vapid-keys`. Changing
 * them later invalidates every existing subscription, so they are set once
 * and left alone.
 *
 * Without them nothing here throws: `pushConfigured()` is false, Settings
 * shows reminders as unavailable, and the daily job does nothing. The product
 * runs without notifications until somebody deliberately turns them on.
 */
export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification opens. A same-origin path. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
};

export type SendResult = "sent" | "gone" | "failed";

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "https://hypefitness.club",
      publicKey,
      privateKey,
    );
    configured = true;
  } catch (err) {
    console.error("[push] VAPID keys rejected:", err);
    configured = false;
  }
  return configured;
}

/**
 * Send one notification to one browser.
 *
 * `gone` means the push service says this subscription no longer exists — the
 * member cleared site data, uninstalled, or revoked the permission in the
 * browser. The caller deletes the row; retrying would fail forever.
 */
export async function sendPush(
  subscription: StoredSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  if (!pushConfigured()) return "failed";
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      // A reminder that could not be delivered within a day is no longer one.
      { TTL: 60 * 60 * 20, urgency: "normal" },
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] send failed:", status ?? err);
    return "failed";
  }
}
