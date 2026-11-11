"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n-server";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { TEST_COPY } from "@/lib/push/reminders";
import { pushConfigured, sendPush } from "@/lib/push/send";

/**
 * Reminders, from the member's side: switch on, switch off, try one.
 *
 * None of this is behind the paywall. The two reminders that matter most are
 * about the paywall — the free days ending, and having ended — and they are
 * addressed to exactly the accounts a paid guard would turn away.
 *
 * Everything here goes through the member's own session and RLS (migration
 * 059): a caller can only ever write, read or delete rows carrying their own
 * user id. There is no service-role client in this file.
 */

type BrowserSubscription = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

/** Store the subscription a browser handed back after permission was given. */
export async function savePushSubscription(input: BrowserSubscription): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");
  if (!pushConfigured()) return fail("push_unavailable");

  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
  // The shapes a real push service produces. Anything else is not a
  // subscription, and the send would only fail later with a worse message.
  if (!endpoint.startsWith("https://") || endpoint.length > 1000) return fail("push_invalid");
  if (p256dh.length < 20 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) {
    return fail("push_invalid");
  }

  const supabase = await createClient();
  const locale = await getLocale();

  // An endpoint is unique. If this browser is already on file — a second tap,
  // or permission re-granted — the old row is dropped and written afresh. A
  // row belonging to somebody else (a shared phone, a different account) is
  // invisible to this session, so the insert below fails and is reported.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint, p256dh, auth, locale });
  if (error) return fail("push_save_failed");

  revalidatePath("/settings");
  return ok(undefined);
}

/** Forget this browser. Called when reminders are switched off. */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");
  if (typeof endpoint !== "string" || !endpoint) return fail("push_invalid");

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return fail("push_save_failed");

  revalidatePath("/settings");
  return ok(undefined);
}

/**
 * Send the member one notification, now, to every browser they have on file.
 *
 * This is the button in Settings. Its job is to answer "did that work?" at the
 * moment somebody switches reminders on, instead of leaving them to find out
 * tomorrow evening that the phone's own settings were blocking it.
 *
 * Returns how many browsers it reached. Zero with reminders "on" is a real
 * answer — it means the permission was revoked outside the app — and the stale
 * rows are cleaned up on the way.
 */
export async function sendTestPush(): Promise<ActionResult<{ sent: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");
  if (!pushConfigured()) return fail("push_unavailable");

  const supabase = await createClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, locale")
    .eq("user_id", user.id);
  if (!subscriptions?.length) return fail("push_not_enabled");

  let sent = 0;
  for (const subscription of subscriptions) {
    const copy = subscription.locale === "en" ? TEST_COPY.en : TEST_COPY.tn;
    const result = await sendPush(subscription, { ...copy, url: TEST_COPY.url, tag: "hype-test" });
    if (result === "sent") sent += 1;
    if (result === "gone") {
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    }
  }

  if (sent === 0) return fail("push_test_failed");
  return ok({ sent });
}
