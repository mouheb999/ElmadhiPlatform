"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/actions/push";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";

/**
 * Where this browser stands.
 *
 *   checking     not known yet — nothing is drawn as on or off
 *   unsupported  the browser cannot receive a push at all
 *   needs_home   an iPhone browser tab: iOS only delivers to a site that has
 *                been added to the home screen, so that comes first
 *   blocked      the member said no in the browser's own prompt; only the
 *                phone's settings can undo that
 *   off / on     the switch
 */
type Status = "checking" | "unsupported" | "needs_home" | "blocked" | "off" | "on";

const NOTE: Partial<Record<Status, StringKey>> = {
  unsupported: "rem.unsupported",
  needs_home: "rem.needs_home",
  blocked: "rem.blocked",
};

const ERRORS: Record<string, StringKey> = {
  push_unavailable: "rem.unavailable",
  push_not_enabled: "rem.test_none",
  push_test_failed: "rem.test_failed",
};

/** The key the browser needs, in the byte form `subscribe` wants. */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function readStatus(): Promise<Status> {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return ios && !installed ? "needs_home" : "unsupported";
  if (Notification.permission === "denied") return "blocked";

  // `getRegistration`, not `ready`: `ready` never resolves when no worker is
  // registered (local development), and the card would sit on "checking".
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "unsupported";
  const existing = await registration.pushManager.getSubscription();
  return existing ? "on" : "off";
}

/**
 * Reminders, switched on by the member and nobody else.
 *
 * A browser only delivers notifications after its own permission prompt, and
 * it only shows that prompt once: a "no" there is permanent until the member
 * digs through the phone's settings. So the prompt is never raised on arrival.
 * It is raised here, by a tap on a switch labelled with what it does, by
 * somebody who went looking for it — the one moment the answer is likely to be
 * yes.
 *
 * The test button is the other half. Permission granted is not the same as a
 * notification arriving: the phone may have the browser muted, or be in a
 * focus mode. Sending one on the spot turns "it should work" into something
 * the member has seen with their own eyes, and it is the first thing to try
 * when somebody says reminders are not reaching them.
 *
 * `vapidKey` is null when the server has no push keys configured. The card
 * then says reminders are not available yet rather than offering a switch
 * that cannot work.
 */
export function RemindersCard({ locale, vapidKey }: { locale: Locale; vapidKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    readStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function say(key: StringKey, good = false) {
    setMessage({ text: t(locale, key), good });
  }

  function turnOn() {
    if (!vapidKey) return;
    setMessage(null);
    startTransition(async () => {
      try {
        // The browser's own prompt. Anything but "granted" ends here.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(vapidKey),
          }));
        const saved = await savePushSubscription(subscription.toJSON());
        if (!saved.ok) {
          // Not on file with us, so it must not stay live in the browser:
          // a subscription the server does not know is a switch that lies.
          await subscription.unsubscribe().catch(() => undefined);
          say(ERRORS[saved.error] ?? "rem.failed");
          return;
        }
        setStatus("on");
        say("rem.on_done", true);
      } catch {
        say("rem.failed");
      }
    });
  }

  function turnOff() {
    setMessage(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        say("rem.failed");
      }
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestPush();
      if (result.ok) say("rem.test_sent", true);
      else say(ERRORS[result.error] ?? "rem.test_failed");
    });
  }

  const on = status === "on";
  const canSwitch = vapidKey !== null && (status === "on" || status === "off");
  const note = vapidKey === null ? "rem.unavailable" : NOTE[status];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-accent">
            <Bell className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">{t(locale, "rem.title")}</span>
            <span className="text-[13px] leading-snug text-muted">{t(locale, "rem.sub")}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t(locale, "rem.title")}
            disabled={!canSwitch || isPending}
            onClick={on ? turnOff : turnOn}
            className={cn(
              "relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40",
              on ? "bg-accent" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[inset-inline-start] duration-200",
                on ? "start-[24px]" : "start-1",
              )}
            />
          </button>
        </div>

        {note && <p className="text-[13px] leading-snug text-muted">{t(locale, note)}</p>}

        {on && (
          <button
            type="button"
            onClick={test}
            disabled={isPending}
            className="press self-start rounded-full bg-surface2 px-4 py-2 text-[14px] font-bold text-ink disabled:opacity-50"
          >
            {t(locale, isPending ? "rem.sending" : "rem.test")}
          </button>
        )}

        {message && (
          <p
            role="status"
            className={cn("text-[13px] font-semibold leading-snug", message.good ? "text-accent" : "text-danger")}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
