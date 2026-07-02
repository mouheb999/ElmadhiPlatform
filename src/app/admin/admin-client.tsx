"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updatePaymentSettings,
  updatePaymentMethod,
  activateRequest,
  rejectRequest,
  type SettingsInput,
  type MethodInput,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Locale, pick, t } from "@/lib/i18n";
import type { Database } from "@/types/db";

type Settings = Database["public"]["Tables"]["payment_settings"]["Row"];
type Method = Database["public"]["Tables"]["payment_methods"]["Row"];
type Request = Database["public"]["Tables"]["payment_requests"]["Row"] & {
  email: string | null;
};

type Props = {
  locale: Locale;
  settings: Settings | null;
  methods: Method[];
  requests: Request[];
};

const fieldClass =
  "min-h-24 w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function AdminClient({ locale, settings, methods, requests }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <RequestsCard locale={locale} requests={requests} />
      <SettingsCard locale={locale} settings={settings} />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">{t(locale, "admin.methods")}</h2>
        {methods.map((m) => (
          <MethodCard key={m.id} locale={locale} method={m} />
        ))}
      </div>
    </div>
  );
}

function RequestsCard({
  locale,
  requests,
}: {
  locale: Locale;
  requests: Request[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? t(locale, "common.error"));
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(locale, "admin.requests")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        {requests.length === 0 && (
          <p className="text-sm text-muted">{t(locale, "admin.no_requests")}</p>
        )}
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">
                {r.email ?? r.user_id}
              </p>
              <p className="text-sm text-muted">
                {r.method_key} · {r.amount_tnd} DT ·{" "}
                {r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => act(() => activateRequest(r.id))}
              >
                {t(locale, "admin.activate")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => act(() => rejectRequest(r.id))}
              >
                {t(locale, "admin.reject")}
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
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updatePaymentSettings(form);
      setStatus(res.ok ? t(locale, "admin.saved") : res.error);
    });
  }

  return (
    <Card>
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
          {status && <span className="text-sm text-muted">{status}</span>}
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
  });
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updatePaymentMethod(form);
      setStatus(res.ok ? t(locale, "admin.saved") : res.error);
    });
  }

  return (
    <Card>
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
          {status && <span className="text-sm text-muted">{status}</span>}
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
