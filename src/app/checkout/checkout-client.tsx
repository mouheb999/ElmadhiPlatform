"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPaymentRequest } from "@/app/actions/payment";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type Locale, dir, pick, t } from "@/lib/i18n";
import type { Database } from "@/types/db";

type Settings = Database["public"]["Tables"]["payment_settings"]["Row"];
type Method = Database["public"]["Tables"]["payment_methods"]["Row"];

type Props = {
  locale: Locale;
  email: string;
  paymentStatus: string;
  settings: Settings | null;
  methods: Method[];
};

function buildWhatsAppUrl(
  number: string,
  template: string,
  email: string,
  method: string,
  amount: string,
): string {
  const digits = number.replace(/[^\d]/g, "");
  // Template already contains %0A for newlines; fill placeholders then encode
  // only the dynamic values (the template's %0A must stay literal).
  const text = template
    .replaceAll("{email}", encodeURIComponent(email))
    .replaceAll("{method}", encodeURIComponent(method))
    .replaceAll("{amount}", encodeURIComponent(amount));
  return `https://wa.me/${digits}?text=${text}`;
}

export function CheckoutClient({
  locale,
  email,
  paymentStatus,
  settings,
  methods,
}: Props) {
  const router = useRouter();
  const direction = dir(locale);
  const [openKey, setOpenKey] = useState<string | null>(
    methods[0]?.key ?? null,
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const price = settings?.price_tnd ?? 89;
  const compareAt = settings?.compare_at_tnd ?? null;
  const offerLabel = pick(locale, settings?.offer_label_en, settings?.offer_label_ar);
  const messageTemplate =
    (locale === "tn"
      ? settings?.whatsapp_message_ar
      : settings?.whatsapp_message_en) ?? "";

  const activeMethod = useMemo(
    () => methods.find((m) => m.key === openKey) ?? null,
    [methods, openKey],
  );

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  function confirmAndOpenWhatsApp() {
    if (!activeMethod) return;
    setError(null);
    const number = settings?.whatsapp_number ?? "";
    if (!number) {
      setError(t(locale, "checkout.no_whatsapp"));
      return;
    }
    const methodLabel = pick(locale, activeMethod.label_en, activeMethod.label_ar);
    const url = buildWhatsAppUrl(
      number,
      messageTemplate,
      email,
      methodLabel,
      String(price),
    );

    startTransition(async () => {
      const res = await createPaymentRequest(activeMethod.key);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      router.refresh();
    });
  }

  // ---- Already active ----
  if (paymentStatus === "active") {
    return (
      <Shell direction={direction}>
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>{t(locale, "checkout.active_title")}</CardTitle>
            <CardDescription>{t(locale, "checkout.active_body")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard">{t(locale, "checkout.go_dashboard")}</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ---- Pending review ----
  if (paymentStatus === "pending") {
    return (
      <Shell direction={direction}>
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>{t(locale, "checkout.pending_title")}</CardTitle>
            <CardDescription>{t(locale, "checkout.pending_body")}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  // ---- Unpaid: pick a method ----
  return (
    <Shell direction={direction}>
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t(locale, "checkout.title")}</CardTitle>
            <CardDescription>{t(locale, "checkout.subtitle")}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {/* Price + FOMO */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">
                {t(locale, "checkout.lifetime")}
              </span>
              <div className="flex items-baseline gap-2">
                {compareAt != null && (
                  <span className="text-base font-bold text-muted line-through">
                    {compareAt}
                  </span>
                )}
                <span className="text-3xl font-extrabold text-ink">
                  {price}{" "}
                  <span className="text-base font-bold text-muted">DT</span>
                </span>
              </div>
            </div>

            {offerLabel && (
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {offerLabel}
              </div>
            )}

            {/* Method picker */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-ink">
                {t(locale, "checkout.choose_method")}
              </p>

              {methods.map((m) => {
                const label = pick(locale, m.label_en, m.label_ar);
                const instructions = pick(
                  locale,
                  m.instructions_en,
                  m.instructions_ar,
                );
                const isOpen = openKey === m.key;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-colors",
                      isOpen ? "border-accent/50 bg-white/5" : "border-hairline",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : m.key)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                    >
                      <span className="font-bold text-ink">{label}</span>
                      <span
                        className={cn(
                          "text-muted transition-transform",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>

                    {isOpen && (
                      <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
                        {instructions && (
                          <p className="whitespace-pre-line text-sm text-muted">
                            {instructions}
                          </p>
                        )}
                        {m.account_value && (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3 py-2">
                            <code className="truncate text-sm text-ink" dir="ltr">
                              {m.account_value}
                            </code>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => copy(m.account_value!, m.key)}
                            >
                              {copiedKey === m.key
                                ? t(locale, "checkout.copied")
                                : t(locale, "checkout.copy")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={confirmAndOpenWhatsApp}
                disabled={isPending || !activeMethod}
                className="w-full"
              >
                {isPending ? "…" : t(locale, "checkout.whatsapp_cta")}
              </Button>
              <p className="text-center text-xs text-muted">
                {t(locale, "checkout.whatsapp_hint")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({
  direction,
  children,
}: {
  direction: "rtl" | "ltr";
  children: React.ReactNode;
}) {
  return (
    <main
      dir={direction}
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="mb-8">
        <Logo />
      </div>
      {children}
    </main>
  );
}
