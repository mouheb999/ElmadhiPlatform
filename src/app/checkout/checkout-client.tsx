"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
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
import { type Locale, dir, pick, t, type StringKey } from "@/lib/i18n";
import type { Database } from "@/types/db";

type Settings = Database["public"]["Tables"]["payment_settings"]["Row"];
type Method = Database["public"]["Tables"]["payment_methods"]["Row"];
type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

type Tier = "standard" | "premium";

const TIER_FEATURES: Record<Tier, StringKey[]> = {
  standard: ["plans.f_std_1", "plans.f_std_2", "plans.f_std_3", "plans.f_std_4"],
  premium: ["plans.f_prem_all", "plans.f_prem_1", "plans.f_prem_2", "plans.f_prem_3"],
};

type Props = {
  locale: Locale;
  email: string;
  paymentStatus: string;
  planExpiresAt: string | null;
  isRenewal: boolean;
  settings: Settings | null;
  methods: Method[];
  plans: Plan[];
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
  planExpiresAt,
  isRenewal,
  settings,
  methods,
  plans,
}: Props) {
  const router = useRouter();
  const direction = dir(locale);
  const [tier, setTier] = useState<Tier>("premium");
  // Psychological default: the middle option, not the cheapest.
  const [months, setMonths] = useState<number>(3);
  const [openKey, setOpenKey] = useState<string | null>(methods[0]?.key ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const offerLabel = pick(locale, settings?.offer_label_en, settings?.offer_label_ar);
  const messageTemplate =
    (locale === "tn" ? settings?.whatsapp_message_ar : settings?.whatsapp_message_en) ?? "";

  const tierPlans = useMemo(
    () => plans.filter((p) => p.tier === tier).sort((a, b) => a.months - b.months),
    [plans, tier],
  );
  const selectedPlan = tierPlans.find((p) => p.months === months) ?? tierPlans[0] ?? null;
  const monthlyBase = tierPlans.find((p) => p.months === 1)?.price_tnd ?? null;

  const activeMethod = useMemo(
    () => methods.find((m) => m.key === openKey) ?? null,
    [methods, openKey],
  );

  function savingsPct(plan: Plan): number | null {
    if (!monthlyBase || plan.months === 1) return null;
    const full = monthlyBase * plan.months;
    const pct = Math.round((1 - plan.price_tnd / full) * 100);
    return pct > 0 ? pct : null;
  }

  function monthsLabel(m: number): string {
    if (m === 1) return t(locale, "plans.month_1");
    if (m === 3) return t(locale, "plans.months_3");
    return t(locale, "plans.months_6");
  }

  function tierLabel(value: Tier): string {
    return value === "premium" ? t(locale, "plans.premium") : t(locale, "plans.standard");
  }

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
    if (!activeMethod || !selectedPlan) return;
    setError(null);
    const number = settings?.whatsapp_number ?? "";
    if (!number) {
      setError(t(locale, "checkout.no_whatsapp"));
      return;
    }
    const methodLabel = `${tierLabel(tier)} · ${monthsLabel(selectedPlan.months)} — ${pick(locale, activeMethod.label_en, activeMethod.label_ar)}`;
    const url = buildWhatsAppUrl(
      number,
      messageTemplate,
      email,
      methodLabel,
      String(selectedPlan.price_tnd),
    );

    startTransition(async () => {
      const res = await createPaymentRequest(activeMethod.key, selectedPlan.id);
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
    const until = planExpiresAt
      ? new Date(planExpiresAt).toLocaleDateString(locale === "tn" ? "ar-TN" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <Shell direction={direction}>
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>{t(locale, "checkout.active_title")}</CardTitle>
            <CardDescription>
              {t(locale, "checkout.active_body")}
              {until && (
                <>
                  <br />
                  {t(locale, "checkout.active_until")} {until}
                </>
              )}
            </CardDescription>
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

  // ---- Unpaid / expired: pick a plan, then a method ----
  return (
    <Shell direction={direction}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "checkout.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t(locale, "checkout.subtitle")}</p>
        </div>

        {isRenewal && (
          <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold">
            {t(locale, "checkout.renewal_banner")}
          </p>
        )}

        {plans.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-center text-sm text-muted">
            {t(locale, "checkout.no_plans")}
          </p>
        ) : (
          <>
            {/* ---- Tier cards ---- */}
            <div className="grid grid-cols-2 gap-3">
              {(["standard", "premium"] as Tier[]).map((value) => {
                const selected = tier === value;
                const from = plans
                  .filter((p) => p.tier === value)
                  .reduce<number | null>(
                    (min, p) => Math.min(min ?? Infinity, p.price_tnd / p.months),
                    null,
                  );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTier(value)}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-2xl border p-4 text-start transition-colors",
                      selected
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-hairline bg-surface hover:bg-white/5",
                    )}
                  >
                    {value === "premium" && (
                      <span className="absolute -top-2.5 start-3 flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">
                        <Sparkles className="h-3 w-3" />
                        {t(locale, "plans.most_popular")}
                      </span>
                    )}
                    <span className="pt-1 font-extrabold">{tierLabel(value)}</span>
                    {from !== null && (
                      <span className="text-xs text-muted">
                        {t(locale, "plans.from")}{" "}
                        <span className="text-base font-extrabold text-ink tabular-nums">
                          {Math.round(from * 10) / 10}
                        </span>{" "}
                        DT{t(locale, "plans.per_month")}
                      </span>
                    )}
                    <ul className="mt-1 flex flex-col gap-1">
                      {TIER_FEATURES[value].map((key) => (
                        <li key={key} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                          {t(locale, key)}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* ---- Duration picker ---- */}
            <div className="flex flex-col gap-2">
              {tierPlans.map((plan) => {
                const selected = selectedPlan?.id === plan.id;
                const save = savingsPct(plan);
                const perMonth = Math.round((plan.price_tnd / plan.months) * 10) / 10;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setMonths(plan.months)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition-colors",
                      selected
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-hairline bg-surface hover:bg-white/5",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2 font-bold">
                        {monthsLabel(plan.months)}
                        {plan.months === 6 && (
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                            {t(locale, "plans.best_value")}
                          </span>
                        )}
                      </span>
                      {save !== null && monthlyBase !== null && (
                        <span className="text-xs text-muted">
                          <span className="line-through">{monthlyBase * plan.months} DT</span>{" "}
                          <span className="font-bold text-accent">
                            {t(locale, "plans.save")} {save}%
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="text-end tabular-nums">
                      <span className="text-lg font-extrabold">{perMonth}</span>
                      <span className="text-xs text-muted"> DT{t(locale, "plans.per_month")}</span>
                      {plan.months > 1 && (
                        <span className="block text-[11px] text-muted">
                          {plan.price_tnd} DT {t(locale, "plans.billed_every")} {monthsLabel(plan.months)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
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

            {/* ---- Method picker (unchanged manual flow) ---- */}
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm font-bold text-ink">{t(locale, "checkout.choose_method")}</p>

                {methods.map((m) => {
                  const label = pick(locale, m.label_en, m.label_ar);
                  const instructions = pick(locale, m.instructions_en, m.instructions_ar);
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
                          className={cn("text-muted transition-transform", isOpen && "rotate-180")}
                          aria-hidden
                        >
                          ▾
                        </span>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
                          {instructions && (
                            <p className="whitespace-pre-line text-sm text-muted">{instructions}</p>
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

                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={confirmAndOpenWhatsApp}
                    disabled={isPending || !activeMethod || !selectedPlan}
                    className="w-full"
                  >
                    {isPending
                      ? "…"
                      : `${t(locale, "checkout.whatsapp_cta")} · ${selectedPlan?.price_tnd ?? ""} DT`}
                  </Button>
                  <p className="text-center text-xs text-muted">{t(locale, "checkout.whatsapp_hint")}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
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
