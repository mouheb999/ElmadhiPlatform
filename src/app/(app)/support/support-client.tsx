"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import {
  SUPPORT_CATEGORIES,
  toSupportCategory,
  type SupportCategory,
  type SupportTicket,
} from "@/lib/support";
import {
  markSupportSeen,
  replyToSupportTicket,
  submitSupportTicket,
} from "@/app/actions/support";

const TEXTAREA_CLASS =
  "min-h-28 w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Typed against the shared list, so a new category can't ship unlabelled. */
export const CATEGORY_LABEL: Record<SupportCategory, StringKey> = {
  bug: "support.cat_bug",
  payment: "support.cat_payment",
  plan: "support.cat_plan",
  account: "support.cat_account",
  other: "support.cat_other",
};

export const STATUS_LABEL: Record<string, StringKey> = {
  open: "support.status_open",
  answered: "support.status_answered",
  closed: "support.status_closed",
};

/**
 * Report a problem, then keep talking about it in the same thread. Built as
 * one screen — compose at the top, history under it — because a user with a
 * broken app has no patience for a second navigation step.
 */
export function SupportClient({
  locale,
  tickets,
}: {
  locale: Locale;
  tickets: SupportTicket[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await submitSupportTicket({ category, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setSent(true);
      router.refresh();
    });
  }

  function openThread(ticket: SupportTicket) {
    const next = openId === ticket.id ? null : ticket.id;
    setOpenId(next);
    // Opening the thread is what counts as reading the reply.
    if (next && ticket.hasUnreadReply) {
      startTransition(async () => {
        await markSupportSeen(ticket.id);
        router.refresh();
      });
    }
  }

  function reply(ticketId: string) {
    const text = replies[ticketId] ?? "";
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await replyToSupportTicket(ticketId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReplies((prev) => ({ ...prev, [ticketId]: "" }));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-7 w-7 shrink-0 text-accent" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "support.title")}</h1>
          <p className="text-sm text-muted">{t(locale, "support.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <span className="text-xs font-bold text-muted">{t(locale, "support.category")}</span>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                category === value
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-hairline text-muted hover:text-ink",
              )}
            >
              {t(locale, CATEGORY_LABEL[value])}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">{t(locale, "support.message")}</span>
          <textarea
            className={TEXTAREA_CLASS}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSent(false);
            }}
            placeholder={t(locale, "support.message_placeholder")}
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {sent && !error && (
          <p className="flex items-center gap-2 text-sm font-bold text-accent">
            <CheckCircle2 className="h-4 w-4" />
            {t(locale, "support.sent")}
          </p>
        )}

        <Button onClick={send} disabled={isPending || !body.trim()}>
          {isPending ? t(locale, "support.sending") : t(locale, "support.send")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-muted">{t(locale, "support.my_reports")}</h2>
        {tickets.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
            {t(locale, "support.empty")}
          </p>
        ) : (
          tickets.map((ticket) => {
            const open = openId === ticket.id;
            return (
              <div
                key={ticket.id}
                className="overflow-hidden rounded-2xl border border-hairline bg-surface"
              >
                <button
                  type="button"
                  onClick={() => openThread(ticket)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-start"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="truncate">
                        {t(locale, CATEGORY_LABEL[toSupportCategory(ticket.category)])}
                      </span>
                      {ticket.hasUnreadReply && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-bg">
                          {t(locale, "support.new_reply")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {t(locale, STATUS_LABEL[ticket.status] ?? "support.status_open")}
                      {ticket.createdAt
                        ? ` · ${new Date(ticket.createdAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>

                {open && (
                  <div className="flex flex-col gap-3 border-t border-hairline p-4">
                    {ticket.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                          message.sender === "admin"
                            ? "self-start border border-accent/40 bg-accent/10"
                            : "self-end bg-white/5",
                        )}
                      >
                        <div className="text-[11px] font-bold text-muted">
                          {message.sender === "admin"
                            ? t(locale, "support.from_coach")
                            : t(locale, "support.from_you")}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                      </div>
                    ))}

                    <textarea
                      className={TEXTAREA_CLASS}
                      value={replies[ticket.id] ?? ""}
                      onChange={(e) =>
                        setReplies((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      placeholder={t(locale, "support.reply_placeholder")}
                    />
                    <Button
                      size="sm"
                      onClick={() => reply(ticket.id)}
                      disabled={isPending || !(replies[ticket.id] ?? "").trim()}
                    >
                      {t(locale, "support.reply_send")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
