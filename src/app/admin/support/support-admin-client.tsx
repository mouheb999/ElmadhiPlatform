"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { toSupportCategory, type SupportMessage } from "@/lib/support";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/app/(app)/support/support-client";
import { answerSupportTicket, setSupportTicketStatus } from "@/app/actions/support";
import { Avatar, EmptyState, Pill, Segmented } from "@/components/admin/kit";

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
  "min-h-24 w-full rounded-2xl border-0 bg-surface2 px-4 py-3 text-base text-ink placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

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
      <Segmented
        value={showAll ? "all" : "open"}
        onChange={(v) => setShowAll(v === "all")}
        options={[
          {
            value: "open",
            label: t(locale, "admin.support_show_open"),
            count: tickets.filter((ticket) => ticket.status === "open").length,
          },
          { value: "all", label: t(locale, "admin.support_show_all") },
        ]}
      />

      {error && (
        <p className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-semibold text-danger">{error}</p>
      )}

      {visible.length === 0 ? (
        <EmptyState positive icon={CheckCircle2} title={t(locale, "admin.ov_clear_title")} sub={t(locale, "admin.support_empty")} />
      ) : (
        visible.map((ticket) => {
          const open = openId === ticket.id;
          const firstMessage = ticket.messages[0]?.body ?? "";
          return (
            <div
              key={ticket.id}
              className="overflow-hidden rounded-[22px] border border-hairline bg-surface"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : ticket.id)}
                className="press flex min-h-[72px] w-full cursor-pointer items-center gap-3 p-4 text-start"
              >
                <Avatar name={ticket.fullName ?? ticket.email} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">
                      {ticket.fullName ?? ticket.email ?? "—"}
                    </span>
                    <Pill
                      tone={
                        ticket.status === "open"
                          ? "bg-fuel/15 text-fuel"
                          : ticket.status === "answered"
                            ? "bg-accent/15 text-accent"
                            : "bg-white/10 text-muted"
                      }
                    >
                      {t(locale, STATUS_LABEL[ticket.status] ?? "support.status_open")}
                    </Pill>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted">{firstMessage}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {t(locale, CATEGORY_LABEL[toSupportCategory(ticket.category)])}
                    {ticket.createdAt ? ` · ${new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}
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
                          ? "self-end bg-accent/15"
                          : "self-start bg-surface2",
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
