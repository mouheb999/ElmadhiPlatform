/**
 * Telegram pings for things that need a human, now, on a phone.
 *
 * Same mechanism as the landing site's waitlist notifier: a bot token and one
 * or more chat ids in the environment, a plain sendMessage, and no dependency
 * on anyone remembering to open the admin panel.
 *
 * The reason it is here at all: a manual-transfer flow is only as fast as the
 * person confirming it. Somebody who has transferred real money and uploaded
 * the receipt is sitting on a "we're checking" screen with a plan they cannot
 * use, and every hour that passes before an admin looks is an hour of the thing
 * we already know kills this funnel. An in-app badge fixes that only for an
 * admin who happens to be looking at the app.
 *
 * Best-effort by construction. Every path here swallows its own failure: a
 * notification problem must never turn into a failed payment request, which
 * would be strictly worse than a late one. Callers do not await a result they
 * could act on, and there isn't one.
 */

type TelegramEvent =
  | {
      kind: "payment_started";
      name: string | null;
      email: string | null;
      phone: string | null;
      amountTnd: number;
      planTier: string | null;
      planMonths: number | null;
      methodKey: string;
    }
  | {
      kind: "proof_uploaded";
      name: string | null;
      email: string | null;
      phone: string | null;
      amountTnd: number;
      note: string | null;
    }
  | {
      kind: "payment_message";
      name: string | null;
      email: string | null;
      body: string;
    }
  | {
      /**
       * Somebody could not find their payment method in the list.
       *
       * Worth a ping rather than a row in a table: it is a person standing at
       * the till holding money we currently have no way to take, and the
       * window in which answering them still converts is short.
       */
      kind: "method_suggestion";
      name: string | null;
      email: string | null;
      phone: string | null;
      method: string;
    }
  | {
      /**
       * A support report opened from /support.
       *
       * Here for the same reason the payment pings are: the queue is only as
       * fast as the person reading it, and this is the channel a customer who
       * has paid and is still locked out actually reaches for. Until now those
       * landed in a table nobody was told about, while every other event on the
       * same screen rang a phone.
       */
      kind: "support_ticket";
      name: string | null;
      email: string | null;
      phone: string | null;
      category: string;
      body: string;
    };

/** Recipients. One id, or a comma-separated list so several people get pinged. */
function chatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID;
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Telegram messages are not HTML here (no parse_mode is sent), so the only
 * thing user-supplied text can do is be long or ugly. Truncating keeps one
 * pasted essay from pushing the useful lines off a phone notification.
 */
function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function render(event: TelegramEvent): string {
  const who = (name: string | null, email: string | null, phone?: string | null) =>
    [
      name ? `👤 ${clip(name, 60)}` : null,
      email ? `📧 ${clip(email, 80)}` : null,
      phone ? `📱 ${clip(phone, 30)}` : null,
    ].filter(Boolean);

  switch (event.kind) {
    case "payment_started":
      return [
        "💰 New payment request",
        "",
        ...who(event.name, event.email, event.phone),
        `💵 ${event.amountTnd} DT — ${event.planTier ?? "?"} / ${event.planMonths ?? "?"} month(s)`,
        `🏦 ${clip(event.methodKey, 40)}`,
        "",
        "⏳ No receipt attached yet.",
      ].join("\n");

    case "proof_uploaded":
      return [
        "🧾 Receipt uploaded",
        "",
        ...who(event.name, event.email, event.phone),
        `💵 ${event.amountTnd} DT`,
        event.note ? `📝 ${clip(event.note, 300)}` : null,
        "",
        "👉 Ready to review in the admin panel.",
      ]
        .filter((line) => line !== null)
        .join("\n");

    case "payment_message":
      return [
        "💬 Message on a payment",
        "",
        ...who(event.name, event.email),
        "",
        clip(event.body, 500),
      ].join("\n");

    case "method_suggestion":
      return [
        "🧭 Payment method we don't offer",
        "",
        ...who(event.name, event.email, event.phone),
        "",
        `💳 ${clip(event.method, 120)}`,
        "",
        "👉 Reply on their payment thread in the admin panel.",
      ].join("\n");

    case "support_ticket":
      return [
        `🆘 New support report — ${clip(event.category, 30)}`,
        "",
        ...who(event.name, event.email, event.phone),
        "",
        clip(event.body, 500),
        "",
        "👉 Answer it in the admin panel.",
      ].join("\n");
  }
}

/**
 * Fire and forget. Returns once every recipient has been attempted; callers
 * that must not block on the network should not await it.
 */
export async function notifyTelegram(event: TelegramEvent): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const recipients = chatIds();
  // Unconfigured is a normal state, not an error: local development and any
  // deploy without the vars simply doesn't notify.
  if (!token || recipients.length === 0) return;

  const text = render(event);

  await Promise.allSettled(
    recipients.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
          // Telegram being slow must not hold a server action open behind it.
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          console.error("[telegram] notify failed:", res.status, await res.text());
        }
      } catch (err) {
        console.error("[telegram] notify error:", err);
      }
    }),
  );
}
