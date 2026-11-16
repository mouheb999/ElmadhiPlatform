"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, CheckCircle2, ImageOff, MessageCircle, Search, Send } from "lucide-react";
import {
  updatePaymentSettings,
  updatePaymentMethod,
  updatePlanPrice,
  activateRequest,
  markPaymentsSeen,
  rejectRequest,
  replyToPaymentThread,
  setContacted,
  type SettingsInput,
  type MethodInput,
} from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AdminHeader,
  Avatar,
  EmptyState,
  ErrorNote,
  FilterChip,
  SectionTitle,
  Segmented,
  adminCard,
  adminTextarea,
} from "@/components/admin/kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_LOCALE, type Locale, isLocale, pick, t } from "@/lib/i18n";
import { contactEmail, formatPhone, whatsappLink } from "@/lib/phone";
import type { Database } from "@/types/db";

type Settings = Database["public"]["Tables"]["payment_settings"]["Row"];
type Method = Database["public"]["Tables"]["payment_methods"]["Row"];
type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type Request = Database["public"]["Tables"]["payment_requests"]["Row"] & {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  /** The customer's own language — the WhatsApp draft is written in it. */
  userLocale: string | null;
  contactedAt: string | null;
  /** Short-lived signed URL for the uploaded receipt; null when none was sent. */
  proofUrl: string | null;
  /** Nobody has opened the queue since this request last changed. */
  isNew: boolean;
  /** Whole hours this request has been open, measured on the server. */
  waitingHours: number | null;
  /** The conversation with this customer, once a receipt has been uploaded. */
  thread: {
    ticketId: string;
    messages: { id: string; sender: "user" | "admin"; body: string; createdAt: string | null }[];
  } | null;
};

type Props = {
  locale: Locale;
  settings: Settings | null;
  methods: Method[];
  requests: Request[];
  plans: Plan[];
};

const fieldClass = adminTextarea;

type View = "queue" | "setup";
type ReceiptFilter = "all" | "receipt" | "none";

/** 1769 → "1,769". Western digits in both languages. */
function money(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function AdminClient({ locale, settings, methods, requests, plans }: Props) {
  // The queue is the daily job; prices and bank details change a few times a
  // year. They used to share one long scroll, which put four forms between an
  // admin and the bottom of the queue.
  const [view, setView] = useState<View>("queue");
  const total = requests.reduce((sum, r) => sum + (Number(r.amount_tnd) || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title={t(locale, "admin.nav_payments")}
        sub={
          requests.length > 0
            ? t(locale, "admin.pay_waiting_sum")
                .replace("{n}", String(requests.length))
                .replace("{amount}", money(total))
            : t(locale, "admin.pay_clear_sub")
        }
      />
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "queue", label: t(locale, "admin.requests"), count: requests.length },
          { value: "setup", label: t(locale, "admin.pay_tab_setup") },
        ]}
      />

      {view === "queue" ? (
        <RequestsQueue locale={locale} requests={requests} />
      ) : (
        <div className="flex flex-col gap-6">
          <PlansCard locale={locale} plans={plans} />
          <SettingsCard locale={locale} settings={settings} />
          <div className="flex flex-col gap-3">
            <SectionTitle>{t(locale, "admin.methods")}</SectionTitle>
            {methods.map((m) => (
              <MethodCard key={m.id} locale={locale} method={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A wa.me link with the confirmation already typed, in the customer's own
 * language. Returns null when we have no number for them, so the button is
 * simply absent rather than dead.
 */
function waLink(r: Request): string | null {
  const to = isLocale(r.userLocale) ? r.userLocale : DEFAULT_LOCALE;
  const plan =
    r.plan_tier && r.plan_months
      ? `${r.plan_tier === "premium" ? t(to, "plans.premium") : t(to, "plans.standard")} · ${r.plan_months} ${t(to, "admin.months_short")}`
      : (r.method_key ?? "");

  const message = t(to, "admin.wa_msg")
    .replace("{name}", (r.fullName ?? "").split(" ")[0] || "")
    .replace("{plan}", plan)
    .replace("{amount}", String(r.amount_tnd ?? ""));

  return whatsappLink(r.phone, message);
}

const stampFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Tunis",
});

function RequestsQueue({ locale, requests }: { locale: Locale; requests: Request[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const [query, setQuery] = useState("");
  /** The request whose Reject has been tapped once and is waiting for the second. */
  const [rejecting, setRejecting] = useState<string | null>(null);

  // The queue is on screen, so the nav badge has done its job. Done here rather
  // than in the page's render body: a write during render re-runs on every
  // re-render, and a badge that clears before the page is readable is a badge
  // that lies. `markPaymentsSeen` is idempotent, so a double fire costs nothing.
  const hasUnseen = requests.some((r) => r.isNew);
  useEffect(() => {
    if (!hasUnseen) return;
    void markPaymentsSeen();
  }, [hasUnseen]);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setRejecting(null);
      if (!res.ok) setError(res.error ?? t(locale, "common.error"));
      else router.refresh();
    });
  }

  const withReceipt = requests.filter((r) => r.proofUrl).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return requests.filter((r) => {
      if (filter === "receipt" && !r.proofUrl) return false;
      if (filter === "none" && r.proofUrl) return false;
      if (!q) return true;
      return (
        (r.fullName ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && (r.phone ?? "").includes(digits))
      );
    });
  }, [requests, filter, query]);

  if (requests.length === 0) {
    return (
      <EmptyState
        positive
        icon={CheckCircle2}
        title={t(locale, "admin.ov_clear_title")}
        sub={t(locale, "admin.no_requests")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* A receipt is what makes a request actionable, so that split comes first. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <FilterChip selected={filter === "all"} onClick={() => setFilter("all")} count={requests.length}>
          {t(locale, "admin.contact_all")}
        </FilterChip>
        <FilterChip selected={filter === "receipt"} onClick={() => setFilter("receipt")} count={withReceipt}>
          {t(locale, "admin.pay_f_receipt")}
        </FilterChip>
        <FilterChip
          selected={filter === "none"}
          onClick={() => setFilter("none")}
          count={requests.length - withReceipt}
        >
          {t(locale, "admin.pay_f_none")}
        </FilterChip>
      </div>

      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute start-4 h-4 w-4 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "admin.subs_search")}
          className="ps-11"
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {visible.length === 0 && (
        <p className={cn(adminCard, "px-4 py-8 text-center text-sm text-muted")}>
          {t(locale, "admin.subs_none")}
        </p>
      )}

      {visible.map((r) => {
        const name = r.fullName ?? contactEmail(r.email) ?? (r.phone ? formatPhone(r.phone) : r.user_id.slice(0, 8));
        const email = contactEmail(r.email);
        const link = waLink(r);
        const plan =
          r.plan_tier && r.plan_months
            ? `${r.plan_tier === "premium" ? t(locale, "plans.premium") : t(locale, "plans.standard")} · ${r.plan_months} ${t(locale, "admin.months_short")}`
            : null;
        return (
          <article key={r.id} className={cn(adminCard, "flex flex-col gap-4 p-4")}>
            <div className="flex items-start gap-3">
              <Avatar name={r.fullName ?? email} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-bold">{name}</span>
                  {r.isNew && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-bg">
                      {t(locale, "admin.pay_unread")}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[plan, r.method_key].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <WaitingFor locale={locale} hours={r.waitingHours} />
                  <span className="tabular-nums" dir="ltr">
                    {r.created_at ? stampFmt.format(new Date(r.created_at)) : ""}
                  </span>
                </p>
              </div>
              <p className="shrink-0 text-end" dir="ltr">
                <span className="font-num text-2xl font-extrabold tabular-nums">{money(Number(r.amount_tnd) || 0)}</span>{" "}
                <span className="text-xs font-bold text-muted">DT</span>
              </p>
            </div>

            {/* The receipt, inline. Confirming a manual transfer has always
                meant looking at one of these; it just used to mean finding it
                in a WhatsApp thread and matching it to a row by hand. */}
            {r.proofUrl ? (
              <a
                href={r.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t(locale, "admin.proof_open")}
                className="press block overflow-hidden rounded-2xl bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.proofUrl}
                  alt={t(locale, "admin.proof")}
                  loading="lazy"
                  className="mx-auto max-h-56 w-auto object-contain"
                />
              </a>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-learn/10 px-3 py-2.5 text-xs font-bold text-learn">
                <ImageOff className="h-4 w-4 shrink-0" />
                {t(locale, "admin.proof_none")}
              </p>
            )}
            {r.proof_note && (
              <p className="rounded-2xl bg-surface2 px-3 py-2.5 text-sm">
                <span className="block text-[11px] font-bold text-muted">{t(locale, "admin.proof_note")}</span>
                {r.proof_note}
              </p>
            )}

            <div className="flex flex-col gap-0.5 text-sm" dir="ltr">
              {r.phone ? (
                <span className="font-semibold tabular-nums">{formatPhone(r.phone)}</span>
              ) : (
                <span className="text-muted">{t(locale, "admin.no_phone")}</span>
              )}
              {email && <span className="truncate text-xs text-muted">{email}</span>}
            </div>

            {/* Answering in place. The WhatsApp button below is still the right
                tool for chasing somebody who has gone quiet; this is for the
                far commoner case of one question about one transfer. */}
            {r.thread && <PaymentThread locale={locale} thread={r.thread} />}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-12 flex-1"
                disabled={isPending}
                onClick={() => act(() => activateRequest(r.id))}
              >
                <Check />
                {t(locale, "admin.activate")}
              </Button>
              {/* Rejecting takes the customer's access back, so it asks twice. */}
              <Button
                size="sm"
                variant="secondary"
                className={cn("h-12", rejecting === r.id && "bg-danger/20 text-danger hover:bg-danger/25")}
                disabled={isPending}
                onClick={() =>
                  rejecting === r.id ? act(() => rejectRequest(r.id)) : setRejecting(r.id)
                }
                onBlur={() => setRejecting((id) => (id === r.id ? null : id))}
              >
                {rejecting === r.id ? t(locale, "admin.pay_reject_confirm") : t(locale, "admin.reject")}
              </Button>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(locale, "admin.wa_confirm")}
                  title={
                    r.contactedAt
                      ? `${t(locale, "admin.contacted")} · ${stampFmt.format(new Date(r.contactedAt))}`
                      : t(locale, "admin.wa_confirm")
                  }
                  // Mark as the link opens: the admin is already doing the
                  // thing, so asking for a second click to record it is how
                  // the list ends up lying.
                  onClick={() => {
                    if (!r.contactedAt) {
                      startTransition(async () => {
                        await setContacted(r.user_id, true);
                        router.refresh();
                      });
                    }
                  }}
                  className={cn(
                    "press grid h-12 w-12 shrink-0 place-items-center rounded-full",
                    r.contactedAt ? "bg-surface2 text-muted" : "bg-accent/15 text-accent",
                  )}
                >
                  {r.contactedAt ? <CheckCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * The conversation about one payment, inline in the queue.
 *
 * The customer's side of this lives on /checkout, on the very screen where they
 * are waiting — so an answer typed here lands where they are already looking
 * rather than in a channel they have to go and check.
 */
function PaymentThread({
  locale,
  thread,
}: {
  locale: Locale;
  thread: NonNullable<Request["thread"]>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await replyToPaymentThread(thread.ticketId, text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {t(locale, "admin.pay_thread")}
      </p>

      {thread.messages.length === 0 ? (
        <p className="py-1 text-xs text-muted">{t(locale, "admin.pay_no_thread")}</p>
      ) : (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {thread.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-xl px-2.5 py-1.5 text-sm",
                message.sender === "admin"
                  ? "self-end bg-accent/15"
                  : "self-start bg-white/[0.07]",
              )}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                {message.sender === "admin" ? t(locale, "pt.from_us") : t(locale, "pt.from_you")}
              </span>
              <span className="whitespace-pre-line">{message.body}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={t(locale, "admin.pay_reply_ph")}
          className="w-full flex-1 resize-none rounded-xl border-0 bg-bg px-3 py-2 text-base text-ink outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <Button
          size="icon"
          onClick={send}
          disabled={isPending || !draft.trim()}
          aria-label={t(locale, "admin.pay_send")}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PlansCard({ locale, plans }: { locale: Locale; plans: Plan[] }) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(
    () => Object.fromEntries(plans.map((p) => [p.id, String(p.price_tnd)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(plan: Plan) {
    setError(null);
    const price = parseFloat(prices[plan.id]);
    startTransition(async () => {
      const res = await updatePlanPrice(plan.id, price);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedId(plan.id);
      setTimeout(() => setSavedId((id) => (id === plan.id ? null : id)), 1500);
      router.refresh();
    });
  }

  return (
    <Card className="border border-hairline">
      <CardHeader>
        <CardTitle>{t(locale, "admin.plans_title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && (
          <p className="text-sm font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 p-3"
          >
            <span className="text-sm font-bold">
              {plan.tier === "premium" ? t(locale, "plans.premium") : t(locale, "plans.standard")} ·{" "}
              {plan.months} {t(locale, "admin.months_short")}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={prices[plan.id] ?? ""}
                onChange={(e) => setPrices((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                className="h-10 w-20 bg-bg text-center text-base"
              />
              <span className="text-xs text-muted">DT</span>
              <Button size="sm" variant="secondary" className="bg-white/10" disabled={isPending} onClick={() => save(plan)}>
                {savedId === plan.id ? "✓" : t(locale, "admin.save")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsCard({
  locale,
  settings,
}: {
  locale: Locale;
  settings: Settings | null;
}) {
  const [form, setForm] = useState<SettingsInput>({
    price_tnd: settings?.price_tnd ?? 89,
    compare_at_tnd: settings?.compare_at_tnd ?? null,
    offer_label_en: settings?.offer_label_en ?? "",
    offer_label_ar: settings?.offer_label_ar ?? "",
    whatsapp_number: settings?.whatsapp_number ?? "",
    whatsapp_message_en: settings?.whatsapp_message_en ?? "",
    whatsapp_message_ar: settings?.whatsapp_message_ar ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updatePaymentSettings(form);
      setStatus(
        res.ok
          ? { ok: true, text: t(locale, "admin.saved") }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <Card className="border border-hairline [&_input]:bg-surface2">
      <CardHeader>
        <CardTitle>{t(locale, "admin.settings")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "admin.price")}>
            <Input
              type="number"
              value={form.price_tnd}
              onChange={(e) =>
                setForm({ ...form, price_tnd: Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t(locale, "admin.compare_at")}>
            <Input
              type="number"
              value={form.compare_at_tnd ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  compare_at_tnd:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t(locale, "admin.offer_en")}>
            <Input
              value={form.offer_label_en}
              onChange={(e) =>
                setForm({ ...form, offer_label_en: e.target.value })
              }
            />
          </Field>
          <Field label={t(locale, "admin.offer_ar")}>
            <Input
              dir="rtl"
              value={form.offer_label_ar}
              onChange={(e) =>
                setForm({ ...form, offer_label_ar: e.target.value })
              }
            />
          </Field>
          <Field label={t(locale, "admin.whatsapp_number")}>
            <Input
              dir="ltr"
              placeholder="+21612345678"
              value={form.whatsapp_number}
              onChange={(e) =>
                setForm({ ...form, whatsapp_number: e.target.value })
              }
            />
          </Field>
        </div>

        <Field label={t(locale, "admin.msg_en")}>
          <textarea
            className={fieldClass}
            value={form.whatsapp_message_en}
            onChange={(e) =>
              setForm({ ...form, whatsapp_message_en: e.target.value })
            }
          />
        </Field>
        <Field label={t(locale, "admin.msg_ar")}>
          <textarea
            dir="rtl"
            className={fieldClass}
            value={form.whatsapp_message_ar}
            onChange={(e) =>
              setForm({ ...form, whatsapp_message_ar: e.target.value })
            }
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={isPending}>
            {t(locale, "admin.save")}
          </Button>
          {status && (
            <span
              role={status.ok ? "status" : "alert"}
              className={status.ok ? "text-sm text-muted" : "text-sm font-bold text-danger"}
            >
              {status.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MethodCard({ locale, method }: { locale: Locale; method: Method }) {
  const [form, setForm] = useState<MethodInput>({
    id: method.id,
    is_enabled: method.is_enabled,
    label_en: method.label_en,
    label_ar: method.label_ar,
    account_value: method.account_value,
    instructions_en: method.instructions_en,
    instructions_ar: method.instructions_ar,
    hint_en: method.hint_en,
    hint_ar: method.hint_ar,
    logo_url: method.logo_url,
  });
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updatePaymentMethod(form);
      setStatus(
        res.ok
          ? { ok: true, text: t(locale, "admin.saved") }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <Card className="border border-hairline [&_input]:bg-surface2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{pick(locale, method.label_en, method.label_ar)}</span>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) =>
                setForm({ ...form, is_enabled: e.target.checked })
              }
              className="h-4 w-4 accent-accent"
            />
            {t(locale, "admin.method_enabled")}
          </label>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Label (EN)">
            <Input
              value={form.label_en}
              onChange={(e) => setForm({ ...form, label_en: e.target.value })}
            />
          </Field>
          <Field label="Label (AR)">
            <Input
              dir="rtl"
              value={form.label_ar}
              onChange={(e) => setForm({ ...form, label_ar: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t(locale, "admin.account_value")}>
          <Input
            dir="ltr"
            value={form.account_value ?? ""}
            onChange={(e) =>
              setForm({ ...form, account_value: e.target.value || null })
            }
          />
        </Field>
        {/* The two fields the checkout screen renders. Everything below them
            is the old long-form walkthrough, kept because it is the only copy
            of it, and no longer shown to customers. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "admin.hint_en")}>
            <Input
              value={form.hint_en ?? ""}
              onChange={(e) => setForm({ ...form, hint_en: e.target.value || null })}
            />
          </Field>
          <Field label={t(locale, "admin.hint_ar")}>
            <Input
              dir="rtl"
              value={form.hint_ar ?? ""}
              onChange={(e) => setForm({ ...form, hint_ar: e.target.value || null })}
            />
          </Field>
        </div>
        <Field label={t(locale, "admin.logo_url")}>
          <Input
            dir="ltr"
            placeholder="/payment-logos/d17.svg"
            value={form.logo_url ?? ""}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value || null })}
          />
        </Field>
        <Field label={t(locale, "admin.instructions_en")}>
          <textarea
            className={fieldClass}
            value={form.instructions_en ?? ""}
            onChange={(e) =>
              setForm({ ...form, instructions_en: e.target.value || null })
            }
          />
        </Field>
        <Field label={t(locale, "admin.instructions_ar")}>
          <textarea
            dir="rtl"
            className={fieldClass}
            value={form.instructions_ar ?? ""}
            onChange={(e) =>
              setForm({ ...form, instructions_ar: e.target.value || null })
            }
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={isPending}>
            {t(locale, "admin.save")}
          </Button>
          {status && (
            <span
              role={status.ok ? "status" : "alert"}
              className={status.ok ? "text-sm text-muted" : "text-sm font-bold text-danger"}
            >
              {status.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/**
 * How long this request has been open.
 *
 * The average time from a request to somebody resolving it is around twelve
 * hours, and the customer is locked out for all of it. The queue is sorted
 * newest-first — correct for working through new payments, and precisely wrong
 * for spotting the person who has been left. This puts the age on the row so
 * the oldest are visible without re-sorting the list somebody already knows how
 * to read.
 *
 * Amber past two hours, red past twelve. Both thresholds are about the promise
 * the checkout screen now makes out loud ("within a few hours"), not about
 * anything in the data.
 */
function WaitingFor({ locale, hours }: { locale: Locale; hours: number | null }) {
  if (hours === null) return null;

  const label =
    hours < 1
      ? t(locale, "admin.waiting_new")
      : hours < 48
        ? t(locale, "admin.waiting_h").replace("{n}", String(hours))
        : t(locale, "admin.waiting_d").replace("{n}", String(Math.floor(hours / 24)));

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
        hours >= 12
          ? "bg-danger/15 text-danger"
          : hours >= 2
            ? "bg-learn/15 text-learn"
            : "bg-white/10 text-muted",
      )}
    >
      {label}
    </span>
  );
}
