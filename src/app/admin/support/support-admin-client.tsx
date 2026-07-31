"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { toSupportCategory, type SupportMessage } from "@/lib/support";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/app/(app)/support/support-client";
import { answerSupportTicket, setSupportTicketStatus } from "@/app/actions/support";

export type AdminTicket = {
  id: string;
  category: string;
  status: string;
  createdAt: string | null;
  email: string | null;
  fullName: string | null;
  messages: SupportMessage[];
};

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Read a report, answer it, close it. Open threads first — that's the queue. */
export function SupportAdminClient({
  locale,
  tickets,
}: {
  locale: Locale;
  tickets: AdminTicket[];
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = showAll ? tickets : tickets.filter((ticket) => ticket.status === "open");

  function answer(ticketId: string) {
    const text = drafts[ticketId] ?? "";
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await answerSupportTicket(ticketId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDrafts((prev) => ({ ...prev, [ticketId]: "" }));
      router.refresh();
    });
  }

  function toggleStatus(ticket: AdminTicket) {
    setError(null);
    startTransition(async () => {
      const result = await setSupportTicketStatus(
        ticket.id,
        ticket.status === "closed" ? "open" : "closed",
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {[
          { all: false, labelKey: "admin.support_show_open" as StringKey },
          { all: true, labelKey: "admin.support_show_all" as StringKey },
        ].map((tab) => (
          <button
            key={String(tab.all)}
            type="button"
            aria-pressed={showAll === tab.all}
            onClick={() => setShowAll(tab.all)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition-colors",
              showAll === tab.all
                ? "bg-accent text-bg"
                : "border border-hairline text-muted hover:text-ink",
            )}
          >
            {t(locale, tab.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">{error}</p>
      )}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-muted">{t(locale, "admin.support_empty")}</p>
      ) : (
        visible.map((ticket) => {
          const open = openId === ticket.id;
          const firstMessage = ticket.messages[0]?.body ?? "";
          return (
            <div
              key={ticket.id}
              className="overflow-hidden rounded-2xl border border-hairline bg-surface"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : ticket.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-start"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold">{firstMessage}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t(locale, CATEGORY_LABEL[toSupportCategory(ticket.category)])}
                    {" · "}
                    {t(locale, STATUS_LABEL[ticket.status] ?? "support.status_open")}
                    {" · "}
                    {t(locale, "admin.qa_from")}: {ticket.email ?? "—"}
                    {ticket.createdAt ? ` · ${new Date(ticket.createdAt).toLocaleDateString()}` : ""}
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
                          ? "self-end border border-accent/40 bg-accent/10"
                          : "self-start bg-white/5",
                      )}
                    >
                      <div className="text-[11px] font-bold text-muted">
                        {message.sender === "admin"
                          ? t(locale, "support.from_coach")
                          : (ticket.fullName ?? ticket.email ?? t(locale, "support.from_you"))}
                        {message.createdAt
                          ? ` · ${new Date(message.createdAt).toLocaleString()}`
                          : ""}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                    </div>
                  ))}

                  <textarea
                    className={TEXTAREA_CLASS}
                    value={drafts[ticket.id] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                    placeholder={t(locale, "admin.support_answer_placeholder")}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => answer(ticket.id)}
                      disabled={isPending || !(drafts[ticket.id] ?? "").trim()}
                    >
                      {t(locale, "admin.support_send")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleStatus(ticket)}
                      disabled={isPending}
                    >
                      {ticket.status === "closed"
                        ? t(locale, "admin.support_reopen")
                        : t(locale, "admin.support_close")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
